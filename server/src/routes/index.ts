// @ts-nocheck
import type { Express } from "express";
import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "../../storage/storage";
import { isActivated } from "../../../scripts/license-db";

// Import route modules
import { authRoutes } from "./auth.routes";
import { adminRoutes } from "./admin.routes";
import { gameRoutes } from "./game.routes";
import { userRoutes } from "./user.routes";
import { superAdminRoutes } from "./superAdmin.routes";
import { analyticsRoutes } from "./analytics.routes";
import { cartelaRoutes } from "./cartela.routes";
import { balanceRoutes } from "./balance.routes";
import { licenseRoutes, rechargeRoutes, licenseController } from "./license.routes";
import * as adminController from "../controllers/admin.controller";

// WebSocket clients by game ID
const gameClients = new Map<number, Set<WebSocket>>();

export async function registerRoutes(app: Express) {
  // ─── STATIC ASSETS ───────────────────────────────────────────────
  app.use('/attached_assets', express.static('attached_assets'));

  // ─── LICENSE & RECHARGE (Always accessible) ───────────────────────
  app.use("/api/license", licenseRoutes);
  app.post("/api/activate", licenseController.activate);
  app.use("/api/recharge", rechargeRoutes);

  // ─── ACTIVATION GATE ──────────────────────────────────────────────
  app.use("/api", (req, res, next) => {
    const allowed = req.path.startsWith("/license") ||
                   req.path === "/activate" ||
                   req.path.startsWith("/auth");
    if (allowed) return next();
    if (!isActivated()) {
      return res.status(403).json({
        message: "Application not activated. Please upload a valid activation file first."
      });
    }
    next();
  });

  // ─── MOUNT MODULAR ROUTES ─────────────────────────────────────────
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/games", gameRoutes);
  app.use("/api/super-admin", superAdminRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/cartelas", cartelaRoutes);
  app.use("/api/balance", balanceRoutes);
  
  // Transactions route (separate from admin routes for specific client compatibility)
  app.get("/api/transactions/admin", adminController.getAdminTransactions);
  
  // catch-all for remaining user/shop/referral routes
  app.use("/api", userRoutes); 

  // ─── HTTP SERVER & WEBSOCKET ──────────────────────────────────────
  const httpServer = createServer(app);

  const wss = new WebSocketServer({
    server: httpServer,
    path: '/game-ws',
    clientTracking: true
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const gameId = parseInt(url.searchParams.get('gameId') || '0');

    if (gameId) {
      if (!gameClients.has(gameId)) {
        gameClients.set(gameId, new Set());
      }
      gameClients.get(gameId)!.add(ws);

      ws.on('close', () => {
        const clients = gameClients.get(gameId);
        if (clients) {
          clients.delete(ws);
          if (clients.size === 0) gameClients.delete(gameId);
        }
      });

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'call_number') {
            handleNumberCall(gameId);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });
    }
  });

  return { server: httpServer };
}

async function handleNumberCall(gameId: number) {
  const letters = ['B', 'I', 'N', 'G', 'O'];
  const ranges = {
    'B': [1, 15], 'I': [16, 30], 'N': [31, 45],
    'G': [46, 60], 'O': [61, 75]
  };

  const letter = letters[Math.floor(Math.random() * letters.length)];
  const [min, max] = ranges[letter as keyof typeof ranges];
  const number = Math.floor(Math.random() * (max - min + 1)) + min;
  const calledNumber = `${letter}-${number}`;

  const game = await storage.getGame(gameId);
  if (game && game.status === 'active') {
    const calledNumbers = [...(game.calledNumbers || []), calledNumber];
    await storage.updateGame(gameId, { calledNumbers });

    const clients = gameClients.get(gameId);
    if (clients) {
      const response = JSON.stringify({
        type: 'number_called',
        number: calledNumber,
        calledNumbers
      });
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(response);
      });
    }
  }
}
