import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import "./src/lib/console-override";

// Import individual route modules directly
import { authRoutes } from "./src/routes/auth.routes.serverless.js";
import { adminRoutes } from "./src/routes/admin.routes.js";
import { gameRoutes } from "./src/routes/game.routes.js";
import { userRoutes } from "./src/routes/user.routes.js";
import { cartelaRoutes } from "./src/routes/cartela.routes.js";
import { balanceRoutes } from "./src/routes/balance.routes.js";
import { licenseRoutes, licenseController } from "./src/routes/license.routes.js";
import rechargeRoutes from "./src/routes/recharge.routes.js";
import * as adminController from "./src/controllers/admin.controller.js";

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

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session middleware for serverless (using memory store for simplicity)
import session from "express-session";
app.use(session({
  secret: process.env.ENCRYPTION_SECRET || 'bingo-master-secure-shared-secret-key-32',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));

// ─── STATIC ASSETS ───────────────────────────────────────────────
app.use('/attached_assets', express.static('attached_assets'));

// ─── LICENSE & RECHARGE (Always accessible) ───────────────────────
app.use("/api/license", licenseRoutes);
app.post("/api/activate", licenseController.activate);
app.use("/api/recharge", rechargeRoutes);

// ─── ACTIVATION GATE ──────────────────────────────────────────────
app.use("/api", (req, res, next) => {
  const allowed = req.path === "/api/license/status" ||
                 req.path === "/api/license/machine-id" ||
                 req.path === "/activate" ||
                 req.path.startsWith("/auth");
  if (allowed) return next();
  // Activation is frozen - always allow access
  next();
});

// ─── MOUNT MODULAR ROUTES ─────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/cartelas", cartelaRoutes);
app.use("/api/balance", balanceRoutes);

// Admin routes (mount before catch-all to ensure they take precedence)
app.use("/api/admin", adminRoutes);

// Transactions route (separate from admin routes for specific client compatibility)
app.get("/api/transactions/admin", adminController.getAdminTransactions);

// catch-all for remaining user/shop/referral routes
app.use("/api", userRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler for API routes only
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Export for Vercel
export default app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}
