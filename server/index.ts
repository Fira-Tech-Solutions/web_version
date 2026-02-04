import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import session from "express-session";
import { db } from "./db";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./lib/vite";

const app = express();

// Add CORS headers for proper browser communication
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,Pragma,Set-Cookie,Cookie');
  res.header('Access-Control-Expose-Headers', 'Set-Cookie');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Serve static audio files with proper MIME types (before other routes)
import path from "path";
const publicPath = path.resolve(process.cwd(), "public");
app.use(express.static(publicPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    }
  }
}));

// Configure session middleware (using memory store for SQLite)
app.use(session({
  secret: 'bingo-session-secret-key-longer-for-security',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    domain: undefined
  },
  name: 'connect.sid'
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Create HTTP server for Socket.io
  const server = createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Store io instance globally for routes to use
  (global as any).io = io;

  // Handle Socket.io connections
  io.on('connection', (socket) => {
    console.log('Client connected to Socket.io:', socket.id);

    socket.on('disconnect', () => {
      console.log('Client disconnected from Socket.io:', socket.id);
    });
  });

  const { server: routeServer } = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;

  server.listen(port, "0.0.0.0", async () => {
    log(`serving on port ${port}`);
    console.log("SQLite database initialized with better-sqlite3.");
    console.log("Socket.io server initialized for real-time updates.");
    console.log("Hardcoded cartela auto-loading is disabled. Admins can add cartelas manually.");
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      log(`Port ${port} is already in use. Trying to find an alternative port...`);
      // Try alternative ports
      const tryPort = (portToTry: number) => {
        server.listen({
          port: portToTry,
          host: "0.0.0.0",
        }, () => {
          log(`serving on port ${portToTry}`);
        }).on('error', (portErr: any) => {
          if (portErr.code === 'EADDRINUSE' && portToTry < 5010) {
            tryPort(portToTry + 1);
          } else {
            log(`Failed to start server: ${portErr.message}`);
            process.exit(1);
          }
        });
      };
      tryPort(5001);
    } else {
      log(`Failed to start server: ${err.message}`);
      process.exit(1);
    }
  });
})();
