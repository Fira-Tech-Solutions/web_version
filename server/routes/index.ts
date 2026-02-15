// @ts-nocheck
import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import session from "express-session";
import { storage } from "../storage";
import bcrypt from "bcrypt";
import { insertUserSchema, insertGameSchema, insertGamePlayerSchema, insertTransactionSchema, insertCustomCartelaSchema } from "@shared/schema-simple";
import { z } from "zod";
import { getFixedCartelaPattern as getFixedPattern, getCartelaNumbers } from "../lib/fixed-cartelas";
import { encryptData, decryptData, signBalance, verifyBalance, generateKeyPair } from "../lib/crypto";
import { 
  isActivated,
  setActivation,
  isTokenUsed,
  recordToken,
  getTotalRecharged,
  isRechargeUsed,
  recordUsedRecharge,
  generateFileSignature
} from "../db/license-db";

const { privateKey: SYSTEM_PRIVATE_KEY, publicKey: SYSTEM_PUBLIC_KEY } = generateKeyPair();

// Extend Express Request to include session
declare module 'express-serve-static-core' {
  interface Request {
    session: any;
  }
}

// Helper function to emit global balance updates
function emitBalanceUpdate(shopId?: number) {
  const io = (global as any).io;
  if (io) {
    storage.getMasterFloat(shopId).then(masterFloat => {
      io.emit('global_balance_update', { masterFloat, shopId });
    });
  }
}

// WebSocket clients by game ID
const gameClients = new Map<number, Set<WebSocket>>();

// Fixed cartela patterns are now handled by imported functions from fixed-cartelas.ts

// Helper function to check if cartela has bingo
function checkBingoWin(cartelaPattern: number[][], calledNumbers: number[]): { isWinner: boolean; pattern?: string; winningCells?: number[] } {
  const calledSet = new Set(calledNumbers);

  console.log('🔍 DETAILED BINGO CHECK:', {
    pattern: cartelaPattern,
    called: calledNumbers,
    calledSet: Array.from(calledSet)
  });

  // Check rows
  for (let row = 0; row < 5; row++) {
    let rowComplete = true;
    let rowDetails = [];
    for (let col = 0; col < 5; col++) {
      const num = cartelaPattern[row][col];
      const isMarked = (num === 0) || calledSet.has(num);
      rowDetails.push({ num, isMarked, isFree: num === 0 });
      if (num !== 0 && !calledSet.has(num)) {
        rowComplete = false;
      }
    }
    console.log(`Row ${row + 1}:`, { rowDetails, rowComplete });
    if (rowComplete) {
      console.log(`🎯 WINNER FOUND: Horizontal Row ${row + 1}`);
      const winningCells = [];
      for (let col = 0; col < 5; col++) {
        winningCells.push(row * 5 + col);
      }
      return { isWinner: true, pattern: `Horizontal Row ${row + 1}`, winningCells };
    }
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    let colComplete = true;
    let colDetails = [];
    for (let row = 0; row < 5; row++) {
      const num = cartelaPattern[row][col];
      const isMarked = (num === 0) || calledSet.has(num);
      colDetails.push({ num, isMarked, isFree: num === 0 });
      if (num !== 0 && !calledSet.has(num)) {
        colComplete = false;
      }
    }
    console.log(`Column ${col + 1}:`, { colDetails, colComplete });
    if (colComplete) {
      const columnNames = ['B', 'I', 'N', 'G', 'O'];
      console.log(`🎯 WINNER FOUND: Vertical Column ${columnNames[col]}`);
      const winningCells = [];
      for (let row = 0; row < 5; row++) {
        winningCells.push(row * 5 + col);
      }
      return { isWinner: true, pattern: `Vertical Column ${columnNames[col]}`, winningCells };
    }
  }

  // Check diagonal 1 (top-left to bottom-right)
  let diag1Complete = true;
  let diag1Details = [];
  for (let i = 0; i < 5; i++) {
    const num = cartelaPattern[i][i];
    const isMarked = (num === 0) || calledSet.has(num);
    diag1Details.push({ num, isMarked, isFree: num === 0 });
    if (num !== 0 && !calledSet.has(num)) {
      diag1Complete = false;
    }
  }
  console.log('Diagonal 1:', { diag1Details, diag1Complete });
  if (diag1Complete) {
    console.log('🎯 WINNER FOUND: Diagonal (Top-Left to Bottom-Right)');
    const winningCells = [];
    for (let i = 0; i < 5; i++) {
      winningCells.push(i * 5 + i);
    }
    return { isWinner: true, pattern: 'Diagonal (Top-Left to Bottom-Right)', winningCells };
  }

  // Check diagonal 2 (top-right to bottom-left)
  let diag2Complete = true;
  let diag2Details = [];
  for (let i = 0; i < 5; i++) {
    const num = cartelaPattern[i][4 - i];
    const isMarked = (num === 0) || calledSet.has(num);
    diag2Details.push({ num, isMarked, isFree: num === 0 });
    if (num !== 0 && !calledSet.has(num)) {
      diag2Complete = false;
    }
  }
  console.log('Diagonal 2:', { diag2Details, diag2Complete });
  if (diag2Complete) {
    console.log('🎯 WINNER FOUND: Diagonal (Top-Right to Bottom-Left)');
    const winningCells = [];
    for (let i = 0; i < 5; i++) {
      winningCells.push(i * 5 + (4 - i));
    }
    return { isWinner: true, pattern: 'Diagonal (Top-Right to Bottom-Left)', winningCells };
  }

  console.log('❌ NO WINNER FOUND');
  return { isWinner: false, pattern: null };
}

// License/activation gate - block app until activated
import { isActivated } from "../db/license-db";

export async function registerRoutes(app: Express): Promise<{ server: Server; wss: WebSocketServer }> {
  // Serve static files from attached_assets directory
  app.use('/attached_assets', express.static('attached_assets'));

  // License routes (always accessible - no activation required)
  const licenseModule = await import("./license");
  app.use("/api/license", licenseModule.licenseRouter);
  app.post("/api/activate", licenseModule.activateHandler);
  app.use("/api/recharge", licenseModule.rechargeRouter);

  // Activation gate: block all other API routes until activated
  app.use("/api", (req, res, next) => {
    const allowed = req.path.startsWith("/api/license") || req.path === "/api/activate";
    if (allowed) return next();
    if (!isActivated()) {
      return res.status(403).json({ message: "Application not activated. Please upload a valid activation file first." });
    }
    next();
  });

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      console.log(`Login attempt for username: ${username}, password: ${password}`);

      const user = await storage.getUserByUsername(username);
      if (!user) {
        console.log(`User not found: ${username}`);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      console.log(`Found user:`, { username: user.username, password: user.password, role: user.role });

      // Check if password is hashed (starts with $2b$) or plain text
      const isHashedPassword = user.password.startsWith('$2b$');
      let isValidPassword = false;
      
      if (isHashedPassword) {
        // Compare with bcrypt for hashed passwords (existing admin users)
        isValidPassword = await bcrypt.compare(password, user.password);
      } else {
        // Plain text comparison for new users
        isValidPassword = password === user.password;
      }
      
      if (!isValidPassword) {
        console.log(`Password mismatch: provided=${password}, stored=${user.password}, isHashed=${isHashedPassword}`);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (user.isBlocked) {
        if (user.role === 'employee') {
          return res.status(403).json({ message: "Your account has been blocked. Please contact super admin for assistance." });
        } else {
          return res.status(403).json({ message: "Account is blocked" });
        }
      }

      // Check if employee's admin is blocked (cascading block)
      if (user.role === 'employee' && user.shopId) {
        const adminUser = await storage.getUserByShopId(user.shopId);
        if (adminUser && adminUser.isBlocked) {
          return res.status(403).json({ message: "Your account has been blocked. Please contact super admin for assistance." });
        }
      }

      // Set session with both userId and user for compatibility
      req.session.userId = user.id;
      req.session.user = user;

      // Ensure session is saved before sending response
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Session save failed" });
        }

        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed", error: error.message });
    }
  });

  app.post("/api/auth/register-file", async (req, res) => {
    try {
      const { encryptedData } = req.body;
      if (!encryptedData) {
        return res.status(400).json({ message: "Registration file data required" });
      }

      const userData = decryptData(encryptedData);

      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const newUser = await storage.createUser({
        username: userData.username,
        password: userData.password,
        role: 'employee',
        name: userData.fullName || userData.name, // Use fullName from account file, fallback to name
        shopId: userData.shopId,
        accountNumber: userData.accountNumber,
        balance: userData.initialBalance || "0.00", // Use initialBalance from account file
        isBlocked: false
      });

      // Auto-login the user after successful registration
      req.session.userId = newUser.id;
      req.session.user = newUser;

      // Ensure session is saved before sending response
      await new Promise((resolve) => {
        req.session.save((err) => {
          resolve();
        });
      });

      res.json({ 
        message: "Registration successful", 
        username: newUser.username,
        user: newUser, // Include user data for auto-login
        autoLogin: true // Indicate auto-login occurred
      });
    } catch (error) {
      console.error("File registration error:", error);
      res.status(500).json({ message: "Failed to process registration file" });
    }
  });

  app.post("/api/admin/recharge/generate-file", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { employeeAccountNumber, amount, machineId, privateKey } = req.body;
      if (!employeeAccountNumber || !amount) {
        return res.status(400).json({ message: "Employee account number and amount required" });
      }

      // Use provided private key or fall back to system key
      const signingKey = privateKey || SYSTEM_PRIVATE_KEY;
      
      const payload = {
        employeeAccountNumber,
        amount,
        shopId: user.shopId,
        timestamp: new Date().getTime(),
        nonce: Math.random().toString(36).substring(7),
        machineId: machineId || null // Include machine ID if provided
      };

      const signature = signBalance(payload, signingKey);
      const fileData = encryptData({ payload, signature });

      res.json({ fileData, filename: `recharge_${amount}.enc` });
    } catch (error) {
      console.error("Recharge file generation error:", error);
      res.status(500).json({ message: "Failed to generate recharge file" });
    }
  });

  app.post("/api/admin/employees/generate-account-file", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { fullName, username, password, initialBalance, privateKey } = req.body;
      if (!fullName || !username || !password) {
        return res.status(400).json({ message: "Full name, username, and password required" });
      }

      // Use provided private key or fall back to system key
      const signingKey = privateKey || SYSTEM_PRIVATE_KEY;

      const accountNumber = await storage.generateAccountNumber();
      
      const payload = {
        fullName,
        username,
        password,
        accountNumber,
        initialBalance: initialBalance || "0",
        shopId: user.shopId,
        timestamp: new Date().getTime(),
        nonce: Math.random().toString(36).substring(7)
      };

      const signature = signBalance(payload, signingKey);
      const encryptedData = encryptData(payload);

      // Store user data in admin database for tracking
      await storage.createUser({
        username,
        password, // Store as plain text for admin view
        role: 'employee',
        name: fullName,
        shopId: user.shopId,
        accountNumber,
        balance: (parseFloat(initialBalance || "0") * 10).toString(), // Admin view balance (×10 multiplier)
        adminGeneratedBalance: (parseFloat(initialBalance || "0") * 10).toString(), // Track admin-generated balance
        employeePaidAmount: initialBalance || "0", // Track what employee paid
        isBlocked: false
      });

      res.json({ encryptedData, filename: `account_${username}.enc` });
    } catch (error) {
      console.error("Account file generation error:", error);
      res.status(500).json({ message: "Failed to generate account file" });
    }
  });

  app.post("/api/employee/recharge/redeem", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'employee') {
        return res.status(403).json({ message: "Employee access required" });
      }

      const { fileData } = req.body;
      if (!fileData) {
        return res.status(400).json({ message: "Recharge file data required" });
      }

      const { payload, signature } = decryptData(fileData);

      const isValid = verifyBalance(payload, signature, SYSTEM_PUBLIC_KEY);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid signature" });
      }

      if (payload.employeeAccountNumber !== user.accountNumber) {
        return res.status(400).json({ message: "This file is for another account" });
      }

      const currentBalance = parseFloat(user.balance || "0");
      const newBalance = (currentBalance + parseFloat(payload.amount)).toFixed(2);
      await storage.updateUserBalance(user.id, newBalance);

      await storage.createTransaction({
        userId: user.id,
        amount: payload.amount,
        type: 'credit_load',
        description: `File recharge: ${payload.amount}`,
        shopId: user.shopId
      });

      res.json({ message: "Recharge successful", balance: newBalance });
    } catch (error) {
      console.error("Redeem error:", error);
      res.status(500).json({ message: "Failed to redeem recharge file" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // For admins, include their shop's commission rate
      let userWithCommission = { ...user } as any;
      if (user.role === 'admin' && user.shopId) {
        const shop = await storage.getShop(user.shopId);
        if (shop) {
          userWithCommission.commissionRate = shop.profitMargin || '20';
        }
      }

      const { password: _, ...userWithoutPassword } = userWithCommission;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Get user by ID
  app.get("/api/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // User routes
  // Get Master Float (sum of all user balances)
  app.get("/api/admin/master-float", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const masterFloat = await storage.getMasterFloat(user.shopId);
      const allBalances = await storage.getAllUserBalances();
      
      res.json({
        masterFloat,
        shopId: user.shopId,
        allBalances: allBalances.filter(b => b.role === 'employee' && (!user.shopId || b.userId === user.shopId))
      });
    } catch (error) {
      console.error("Error getting master float:", error);
      res.status(500).json({ message: "Failed to get master float" });
    }
  });

  // Load Credit (Admin only)
  app.post("/api/admin/load-credit", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { amount } = req.body;
      
      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      // Add credit to admin's balance (this becomes part of master float)
      const currentBalance = parseFloat(user.balance || "0");
      const newBalance = currentBalance + parseFloat(amount);
      
      await storage.updateUserBalance(userId, newBalance.toString());
      
      // Create transaction record
      await storage.createTransaction({
        adminId: userId,
        shopId: user.shopId,
        amount: amount,
        type: 'credit_load',
        description: 'System credit loaded by admin'
      });

      // Emit balance update
      emitBalanceUpdate(user.shopId);

      res.json({ 
        success: true, 
        newBalance: newBalance.toString(),
        message: `ETB ${amount} loaded successfully`
      });
    } catch (error) {
      console.error("Error loading credit:", error);
      res.status(500).json({ message: "Failed to load credit" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.get("/api/users/shop/:shopId", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const users = await storage.getUsersByShop(shopId);

      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      if (updates.password) {
        updates.password = await bcrypt.hash(updates.password, 10);
      }

      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Additional user routes for admin dashboard
  app.patch("/api/users/:id/password", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.updateUser(id, { password: hashedPassword });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  // Delete user (admin can delete employees from their shop)
  app.delete("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUser = req.session.user;

      if (!currentUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Get the user to be deleted
      const userToDelete = await storage.getUser(id);
      if (!userToDelete) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check permissions: admin can only delete employees from their shop
      if (currentUser.role === 'admin') {
        if (userToDelete.role !== 'employee' || userToDelete.shopId !== currentUser.shopId) {
          return res.status(403).json({ message: "Cannot delete this user" });
        }
      } else if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete user" });
      }

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post("/api/games", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Create game with employee as the owner

      // Check employee's balance
      const userBalance = parseFloat(user.balance?.toString() || '0');
      const cartelas = req.body.cartelas || [];
      const entryFee = parseFloat(req.body.amount || '20');
      const totalCost = cartelas.length * entryFee;

      // Check if employee has sufficient balance
      if (userBalance < 50) {
        return res.status(403).json({
          message: `Insufficient balance. Minimum 50 ETB required to start. Current: ${userBalance.toFixed(2)} ETB`,
          balance: userBalance.toFixed(2),
          required: "50.00",
        });
      }

      if (userBalance < totalCost) {
        return res.status(403).json({
          message: `Insufficient balance for this game size. Need ${totalCost.toFixed(2)} ETB. Current: ${userBalance.toFixed(2)} ETB`,
          balance: userBalance.toFixed(2),
          required: totalCost.toFixed(2),
        });
      }

      console.log("🎮 BACKEND GAME CREATION REQUEST:", {
        body: req.body,
        userId: userId,
        authenticatedUser: user.username,
        userBalance: userBalance,
        totalCost: totalCost,
        timestamp: new Date().toISOString()
      });

      // Use authenticated user's data instead of request body
      const gameData = insertGameSchema.parse({
        ...req.body,
        employeeId: user.id,
        status: "waiting",
        entryFee: String(req.body.amount || "20.00")
      });

      const game = await storage.createGame(gameData);

      // DEDUCT BALANCE NOW
      // Update employee balance
      const newBalance = (userBalance - totalCost).toFixed(2);
      await storage.updateUserBalance(user.id, newBalance);

      // Log transaction?
      // storage.createTransaction({...})
      // But usually 'entry_fee' transaction logs Money IN from players.
      // Is 'deduct balance' a cost to the Shop?
      // "Recharge balance... when playing balance must be deducted".
      // This implies: Shop pays platform to play?
      // OR: Shop Balance = Cash on Hand?
      // If "Admin decrypts balance data", it sounds like "Credit Load".
      // So Shop consumes Credit to run games.

      console.log(`💰 Deducted ${totalCost} from Shop ${shop.id}. New Balance: ${newBalance}`);

      res.json(game);
    } catch (error) {
      console.error("❌ BACKEND GAME CREATION FAILED:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create game" });
    }
  });

  app.patch("/api/games/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const game = await storage.updateGame(id, req.body);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      // Notify WebSocket clients about game update
      const clients = gameClients.get(id);
      if (clients) {
        const message = JSON.stringify({ type: 'game_updated', game });
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }

      res.json(game);
    } catch (error) {
      res.status(500).json({ message: "Failed to update game" });
    }
  });

  app.get("/api/games/:id/players", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const players = await storage.getGamePlayers(gameId);
      res.json(players);
    } catch (error) {
      res.status(500).json({ message: "Failed to get game players" });
    }
  });

  app.post("/api/games/:id/players", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      console.log("📝 BACKEND PLAYER CREATION REQUEST:", {
        gameId,
        body: req.body,
        timestamp: new Date().toISOString()
      });

      const playerData = insertGamePlayerSchema.parse({
        ...req.body,
        gameId,
      });
      console.log("✅ Player data validated:", playerData);

      const player = await storage.createGamePlayer(playerData);
      console.log("🎯 BACKEND PLAYER CREATED SUCCESSFULLY:", {
        playerId: player.id,
        gameId: gameId,
        playerName: player.playerName,
        cartelaNumbers: player.cartelaNumbers
      });

      // Create entry fee transaction
      const game = await storage.getGame(gameId);
      if (game) {
        await storage.createTransaction({
          gameId,
          shopId: game.shopId,
          employeeId: game.employeeId,
          amount: playerData.entryFee,
          type: 'entry_fee',
          description: `Entry fee for ${playerData.playerName}`,
        });

        // Update game prize pool
        const currentPrizePool = parseFloat(game.prizePool || "0");
        const newPrizePool = currentPrizePool + parseFloat(playerData.entryFee);
        await storage.updateGame(gameId, { prizePool: newPrizePool.toString() });
      }

      // Notify WebSocket clients
      const clients = gameClients.get(gameId);
      if (clients) {
        const message = JSON.stringify({ type: 'player_registered', player });
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }

      res.json(player);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to register player" });
    }
  });

  app.delete("/api/games/:gameId/players/:playerId", async (req, res) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const playerId = parseInt(req.params.playerId);

      const success = await storage.removeGamePlayer(playerId);
      if (!success) {
        return res.status(404).json({ message: "Player not found" });
      }

      // Notify WebSocket clients
      const clients = gameClients.get(gameId);
      if (clients) {
        const message = JSON.stringify({ type: 'player_removed', playerId });
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }

      res.json({ message: "Player removed" });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove player" });
    }
  });

  // Game control routes
  app.post("/api/games/:id/start", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const game = await storage.updateGame(gameId, {
        status: 'active',
        startedAt: new Date(),
      });

      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      // Notify WebSocket clients
      const clients = gameClients.get(gameId);
      if (clients) {
        const message = JSON.stringify({ type: 'game_started', game });
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }

      res.json(game);
    } catch (error) {
      res.status(500).json({ message: "Failed to start game" });
    }
  });

  app.post("/api/games/:id/call-number", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const { number } = req.body;

      const game = await storage.getGame(gameId);
      if (!game || game.status !== 'active') {
        return res.status(400).json({ message: "Game not active" });
      }

      const calledNumbers = [...(game.calledNumbers || []), number];
      const updatedGame = await storage.updateGame(gameId, { calledNumbers });

      // Notify WebSocket clients
      const clients = gameClients.get(gameId);
      if (clients) {
        const message = JSON.stringify({ type: 'number_called', number, calledNumbers });
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }

      res.json({ number, calledNumbers });
    } catch (error) {
      res.status(500).json({ message: "Failed to call number" });
    }
  });

  // End game without winner - no revenue recording
  app.post("/api/games/:id/end-without-winner", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      console.log(`🎯 ENDING GAME WITHOUT WINNER - Game ${gameId}`);

      const game = await storage.getGame(gameId);
      if (!game) {
        console.error(`❌ Game ${gameId} not found`);
        return res.status(404).json({ message: "Game not found" });
      }

      // Simply update game status to completed without recording any financial data
      const updatedGame = await storage.updateGame(gameId, {
        status: 'completed',
        completedAt: new Date(),
      });

      console.log(`✅ Game ${gameId} ended without winner - no revenue recorded`);

      res.json({
        game: updatedGame,
        message: "Game ended without winner",
        revenueRecorded: false
      });
    } catch (error) {
      console.error("Error ending game without winner:", error);
      res.status(500).json({ message: "Failed to end game" });
    }
  });

  // Old declare-winner endpoint removed to prevent conflicts with new one

  // Complete game endpoint - wrapper for declare-winner functionality
  app.post("/api/games/:id/complete", async (req, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const { winnerId, winnerName, winningCartela } = req.body;

      console.log(`🎯 GAME COMPLETION REQUEST - Game ${gameId}, Winner ${winnerId}, Cartela ${winningCartela}`);

      // Allow null winnerId for reset scenarios
      const isResetOperation = winnerId === null || winnerId === undefined;
      if (!isResetOperation && !winnerId) {
        console.error(`❌ No winnerId provided for game ${gameId}`);
        return res.status(400).json({ message: "Winner ID is required" });
      }

      // Get game, shop, and player details
      const game = await storage.getGame(gameId);
      if (!game) {
        console.error(`❌ Game ${gameId} not found`);
        return res.status(404).json({ message: "Game not found" });
      }

      const shop = await storage.getShop(game.shopId);
      const players = await storage.getGamePlayers(gameId);
      const employee = await storage.getUser(game.employeeId);

      // For non-reset operations, validate that winner exists
      if (!isResetOperation) {
        const winner = players.find(p => p.id === winnerId);
        if (!winner) {
          console.error(`❌ Winner ${winnerId} not found in game ${gameId} players`);
          return res.status(400).json({ message: "Winner not found in game players" });
        }
      }

      // Calculate total collected from entry fees using ACTUAL marked cartelas
      const shopCartelas = await storage.getCartelasByShop(game.shopId);
      const markedCartelas = shopCartelas.filter(c => c.bookedBy !== null);
      const actualPlayerCount = markedCartelas.length;
      let totalCollectedBirr = actualPlayerCount * parseFloat(game.entryFee || "0");

      console.log(`📊 CORRECTED Revenue calculation: ${actualPlayerCount} marked cartelas × ${game.entryFee} ETB = ${totalCollectedBirr} ETB`);
      console.log(`📊 Marked cartelas breakdown:`, markedCartelas.map(c => ({
        number: c.cartelaNumber,
        source: 'employee',
        bookedBy: c.bookedBy
      })));

      // Update game status 
      const gameUpdateData: any = {
        status: 'completed',
        completedAt: new Date(),
        prizePool: totalCollectedBirr.toString(),
      };

      // Only add winnerId for non-reset operations
      if (!isResetOperation) {
        gameUpdateData.winnerId = winnerId;
      }

      const updatedGame = await storage.updateGame(gameId, gameUpdateData);

      if (isResetOperation) {
        console.log(`🔄 Game ${gameId} reset and completed without winner`);
      } else {
        console.log(`✅ Game ${gameId} marked as completed with winner ${winnerId}`);
      }

      // Process game profits with Super Admin revenue logging
      await storage.processGameProfits(gameId, totalCollectedBirr.toString());
      console.log(`✅ Admin revenue logged from game ${gameId}`);

      // Reset all cartela markings after game completion
      await storage.resetCartelasForShop(game.shopId);
      console.log(`✅ Cartela markings reset for shop ${game.shopId}`);

      // Emit balance update and game completion event
      emitBalanceUpdate(game.shopId);
      const io = (global as any).io;
      if (io) {
        io.emit('game_completed', {
          gameId,
          shopId: game.shopId,
          winnerId,
          totalCollected: totalCollectedBirr.toString()
        });
      }

      res.json({
        success: true,
        game: updatedGame,
        message: isResetOperation ? "Game reset successfully" : "Game completed successfully",
        revenueLogged: true,
        cartelasReset: true,
        isReset: isResetOperation
      });
    } catch (error) {
      console.error("Error completing game:", error);
      res.status(500).json({ message: "Failed to complete game", error: error.message });
    }
  });

  // Game History routes
  app.get("/api/game-history/:employeeId", async (req, res) => {
    try {
      const employeeId = req.params.employeeId === 'undefined' ? undefined : parseInt(req.params.employeeId);
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      if (!employeeId) {
        // If no employeeId provided, return empty array for now
        // This could be enhanced to return all game history for admins
        return res.json([]);
      }

      const history = await storage.getEmployeeGameHistory(employeeId, start, end);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to get game history" });
    }
  });

  // Admin system settings update
  app.post("/api/admin/system-settings", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { adminProfitMargin } = req.body;

      if (adminProfitMargin !== undefined) {
        const updatedShop = await storage.updateShop(user.shopId, {
          profitMargin: adminProfitMargin.toString()
        });

        if (!updatedShop) {
          return res.status(404).json({ message: "Shop not found" });
        }

        res.json({ message: "Settings updated successfully", shop: updatedShop });
      } else {
        res.status(400).json({ message: "No settings provided" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Today's stats route for admin dashboard
  app.get("/api/stats/today/:shopId", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const todayTransactions = await storage.getTransactionsByShop(shopId, startOfDay, endOfDay);

      const todayRevenue = todayTransactions
        .filter(t => t.type === 'entry_fee')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      const todayPrizes = todayTransactions
        .filter(t => t.type === 'prize_payout')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      const todayProfit = todayTransactions
        .filter(t => t.type === 'admin_profit')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      res.json({
        revenue: todayRevenue,
        prizes: todayPrizes,
        profit: todayProfit,
        netIncome: todayProfit
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get today's stats" });
    }
  });

  // Stats routes
  app.get("/api/stats/employee/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const stats = await storage.getEmployeeStats(id, start, end);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get employee stats" });
    }
  });

  // Update shop settings (commission rate, profit margin)
  app.patch("/api/shops/:shopId", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const user = req.session?.user;

      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { profitMargin } = req.body;

      // Only admins can update profit margins
      const updateData: any = {};
      if (profitMargin !== undefined) {
        updateData.profitMargin = profitMargin.toString();
      }

      const updatedShop = await storage.updateShop(shopId, updateData);

      if (!updatedShop) {
        return res.status(404).json({ message: "Shop not found" });
      }

      res.json(updatedShop);
    } catch (error) {
      res.status(500).json({ message: "Failed to update shop" });
    }
  });

  // Get today's games for a shop
  app.get("/api/games/shop/:shopId/today", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      const games = await storage.getGamesByShop(shopId);
      const todayGames = games.filter(game => {
        const gameDate = new Date(game.createdAt);
        return gameDate >= startOfDay && gameDate < endOfDay;
      });

      // Get players for each game
      const gamesWithPlayers = await Promise.all(
        todayGames.map(async (game) => {
          const players = await storage.getGamePlayers(game.id);
          const employee = await storage.getUser(game.employeeId);
          return {
            ...game,
            players,
            employee: employee ? { name: employee.name } : null
          };
        })
      );

      res.json(gamesWithPlayers);
    } catch (error) {
      res.status(500).json({ message: "Failed to get today's games" });
    }
  });

  // Get daily income for a shop
  app.get("/api/shops/:shopId/daily-income", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const transactions = await storage.getTransactionsByShop(shopId, startOfDay);
      const totalIncome = transactions
        .filter(t => t.type === 'entry_fee')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      const totalPayout = transactions
        .filter(t => t.type === 'prize_payout')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      res.json({
        amount: (totalIncome - totalPayout).toFixed(2),
        totalIncome: totalIncome.toFixed(2),
        totalPayout: totalPayout.toFixed(2)
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get daily income" });
    }
  });

  // Update employee password
  app.patch("/api/users/:userId/password", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const updatedUser = await storage.updateUser(userId, { password: hashedPassword });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  // Retail Report API
  app.get("/api/reports/retail/:shopId", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const { dateFrom, dateTo, sortBy, order } = req.query;

      const start = dateFrom ? new Date(dateFrom as string) : new Date();
      const end = dateTo ? new Date(dateTo as string) : new Date();

      const games = await storage.getGamesByShop(shopId);
      const filteredGames = games.filter(game => {
        const gameDate = new Date(game.createdAt);
        return gameDate >= start && gameDate <= end;
      });

      const reportData = await Promise.all(
        filteredGames.map(async (game) => {
          const players = await storage.getGamePlayers(game.id);
          const employee = await storage.getUser(game.employeeId);
          return {
            ...game,
            shopName: employee?.name || 'Shop',
            playerCount: players.length,
            stakeAmount: (players.length * parseFloat(game.entryFee || "0")).toString(),
            claimedAmount: game.status === 'completed' ? game.prizePool : "0.00",
            netBalance: (players.length * parseFloat(game.entryFee || "0") - parseFloat(game.prizePool || "0")).toString()
          };
        })
      );

      // Sort data
      if (sortBy === 'stake') {
        reportData.sort((a, b) => {
          const aVal = parseFloat(a.stakeAmount);
          const bVal = parseFloat(b.stakeAmount);
          return order === 'DESC' ? bVal - aVal : aVal - bVal;
        });
      }

      res.json(reportData);
    } catch (error) {
      res.status(500).json({ message: "Failed to get retail report" });
    }
  });

  // Report Summary API
  app.get("/api/reports/summary/:shopId", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const { dateFrom, dateTo } = req.query;

      const start = dateFrom ? new Date(dateFrom as string) : new Date();
      const end = dateTo ? new Date(dateTo as string) : new Date();

      const transactions = await storage.getTransactionsByShop(shopId, start, end);
      const totalIncome = transactions
        .filter(t => t.type === 'entry_fee')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      const totalPayout = transactions
        .filter(t => t.type === 'prize_payout')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      res.json({
        netBalance: (totalIncome - totalPayout).toFixed(2),
        totalIncome: totalIncome.toFixed(2),
        totalPayout: totalPayout.toFixed(2)
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get report summary" });
    }
  });

  // Transaction routes
  app.get("/api/transactions/shop/:shopId", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const transactions = await storage.getTransactionsByShop(shopId, start, end);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to get transactions" });
    }
  });

  app.get("/api/transactions/employee/:employeeId", async (req, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId);
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const transactions = await storage.getTransactionsByEmployee(employeeId, start, end);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to get transactions" });
    }
  });

  // Referral commission routes
  app.get("/api/referral-commissions/:referrerId", async (req: Request, res: Response) => {
    try {
      const referrerId = parseInt(req.params.referrerId);
      const commissions = await storage.getReferralCommissions(referrerId);
      res.json(commissions);
    } catch (error) {
      console.error("Error fetching referral commissions:", error);
      res.status(500).json({ message: "Failed to fetch referral commissions" });
    }
  });

  // Submit withdrawal request
  app.post("/api/referral-commissions/withdraw", async (req: Request, res: Response) => {
    try {
      const { adminId, amount, bankAccount } = req.body;

      if (!adminId || !amount || !bankAccount) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const result = await storage.createWithdrawalRequest({
        adminId,
        amount: amount.toString(),
        bankAccount,
        type: 'referral_commission',
        status: 'pending'
      });

      res.json(result);
    } catch (error) {
      console.error("Failed to create withdrawal request:", error);
      res.status(500).json({ message: "Failed to submit withdrawal request" });
    }
  });

  // Convert commission to credit
  app.post("/api/referral-commissions/convert", async (req: Request, res: Response) => {
    try {
      const { adminId, amount } = req.body;

      if (!adminId || !amount) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const result = await storage.convertCommissionToCredit(adminId, amount);
      res.json(result);
    } catch (error) {
      console.error("Failed to convert commission to credit:", error);
      res.status(500).json({ message: "Failed to convert commission to credit" });
    }
  });

  app.patch("/api/referral-commissions/:id/:action", async (req: Request, res: Response) => {
    try {
      const commissionId = parseInt(req.params.id);
      const action = req.params.action as 'withdraw' | 'convert_to_credit';

      if (!['withdraw', 'convert_to_credit'].includes(action)) {
        return res.status(400).json({ message: "Invalid action" });
      }

      const commission = await storage.processReferralCommission(commissionId, action);
      res.json(commission);
    } catch (error) {
      console.error("Error processing referral commission:", error);
      res.status(500).json({ message: "Failed to process referral commission" });
    }
  });

  // Withdrawal requests routes
  app.get("/api/withdrawal-requests", async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role === "admin") {
        // Admin can see all requests
        const requests = await storage.getAllWithdrawalRequests();
        res.json(requests);
      } else {
        return res.status(403).json({ message: "Access denied" });
      }
    } catch (error) {
      console.error("Error fetching withdrawal requests:", error);
      res.status(500).json({ message: "Failed to fetch withdrawal requests" });
    }
  });

  app.post("/api/withdrawal-requests", async (req: Request, res: Response) => {
    try {
      const { amount, bankAccount, type } = req.body;
      const userId = req.session?.userId;

      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Validate amount and check available balance
      const requestAmount = parseFloat(amount);
      if (isNaN(requestAmount) || requestAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      if (type === "credit_balance") {
        const currentBalance = parseFloat(user.creditBalance);
        if (requestAmount > currentBalance) {
          return res.status(400).json({ message: "Insufficient credit balance" });
        }
      } else if (type === "referral_commission") {
        const commissions = await storage.getReferralCommissions(userId);
        const availableCommissions = commissions
          .filter(c => c.status === 'pending')
          .reduce((sum, c) => sum + parseFloat(c.commissionAmount), 0);

        if (requestAmount > availableCommissions) {
          return res.status(400).json({ message: "Insufficient commission balance" });
        }
      } else {
        return res.status(400).json({ message: "Invalid withdrawal type" });
      }

      const request = await storage.createWithdrawalRequest({
        adminId: userId,
        amount: amount.toString(),
        bankAccount,
        type,
      });

      res.json(request);
    } catch (error) {
      console.error("Error creating withdrawal request:", error);
      res.status(500).json({ message: "Failed to create withdrawal request" });
    }
  });

  app.patch("/api/withdrawal-requests/:id/:action", async (req: Request, res: Response) => {
    try {
      const { id, action } = req.params;
      const { rejectionReason } = req.body;
      const userId = req.session?.userId;

      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      if (action === "approve") {
        await storage.approveWithdrawalRequest(parseInt(id), userId);
      } else if (action === "reject") {
        if (!rejectionReason) {
          return res.status(400).json({ message: "Rejection reason required" });
        }
        await storage.rejectWithdrawalRequest(parseInt(id), userId, rejectionReason);
      } else {
        return res.status(400).json({ message: "Invalid action" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error processing withdrawal request:", error);
      res.status(500).json({ message: "Failed to process withdrawal request" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time game updates on a separate path to avoid Vite HMR conflicts
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
          if (clients.size === 0) {
            gameClients.delete(gameId);
          }
        }
      });

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'call_number') {
            // Auto-call next number for demo
            const letters = ['B', 'I', 'N', 'G', 'O'];
            const ranges = {
              'B': [1, 15],
              'I': [16, 30],
              'N': [31, 45],
              'G': [46, 60],
              'O': [61, 75]
            };

            const letter = letters[Math.floor(Math.random() * letters.length)];
            const [min, max] = ranges[letter as keyof typeof ranges];
            const number = Math.floor(Math.random() * (max - min + 1)) + min;
            const calledNumber = `${letter}-${number}`;

            // Update game with called number
            const game = await storage.getGame(gameId);
            if (game && game.status === 'active') {
              const calledNumbers = [...(game.calledNumbers || []), calledNumber];
              await storage.updateGame(gameId, { calledNumbers });

              // Broadcast to all clients
              const clients = gameClients.get(gameId);
              if (clients) {
                const response = JSON.stringify({
                  type: 'number_called',
                  number: calledNumber,
                  calledNumbers
                });
                clients.forEach(client => {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(response);
                  }
                });
              }
            }
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });
    }
  });

  // Additional API routes for admin dashboard
  app.get("/api/games/shop", async (req, res) => {
    try {
      const games = await storage.getGamesByShop(1);
      res.json(games);
    } catch (error) {
      res.status(500).json({ message: "Failed to get games" });
    }
  });

  app.get("/api/users/shop", async (req, res) => {
    try {
      const users = await storage.getUsersByShop(1);
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Failed to get shop users" });
    }
  });

  // Admin Employee Management API Endpoints

  // Update employee password
  app.patch("/api/admin/employees/:id/password", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const employeeId = parseInt(req.params.id);
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Verify employee belongs to admin's shop
      const employee = await storage.getUser(employeeId);
      if (!employee || employee.role !== 'employee' || employee.shopId !== user.shopId) {
        return res.status(404).json({ message: "Employee not found in your shop" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(employeeId, hashedPassword);

      // Update user balance and emit balance update
      const updatedUser = await storage.updateUserBalance(employeeId, newBalance.toString());
      emitBalanceUpdate(updatedUser?.shopId);
      
      res.json({ success: true, newBalance: updatedUser?.creditBalance, message: "Password updated successfully" });
    } catch (error) {
      console.error("Failed to update employee password:", error);
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  // Get employee profit margins for admin's shops
  app.get("/api/admin/employee-profit-margins", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const margins = await storage.getEmployeeProfitMarginsByAdmin(user.id);
      res.json(margins);
    } catch (error) {
      console.error("Failed to get employee profit margins:", error);
      res.status(500).json({ message: "Failed to get profit margins" });
    }
  });

  // Set employee profit margin for a specific shop
  app.post("/api/admin/employee-profit-margins", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const marginData = insertEmployeeProfitMarginSchema.parse(req.body);

      // Verify shop belongs to admin
      const shop = await storage.getShop(marginData.shopId);
      if (!shop || shop.adminId !== user.id) {
        return res.status(404).json({ message: "Shop not found or not owned by you" });
      }

      // Verify employee exists and belongs to a shop under this admin
      const employee = await storage.getUser(marginData.employeeId);
      if (!employee || employee.role !== 'employee') {
        return res.status(404).json({ message: "Employee not found" });
      }

      const margin = await storage.setEmployeeProfitMargin(marginData);
      res.json(margin);
    } catch (error) {
      console.error("Failed to set employee profit margin:", error);
      res.status(500).json({ message: "Failed to set profit margin" });
    }
  });

  // Update employee profit margin
  app.patch("/api/admin/employee-profit-margins/:id", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const marginId = parseInt(req.params.id);
      const { profitMargin } = req.body;

      if (!profitMargin || parseFloat(profitMargin) < 0 || parseFloat(profitMargin) > 100) {
        return res.status(400).json({ message: "Invalid profit margin" });
      }

      const updatedMargin = await storage.updateEmployeeProfitMargin(marginId, profitMargin, user.id);
      res.json(updatedMargin);
    } catch (error) {
      console.error("Failed to update employee profit margin:", error);
      res.status(500).json({ message: "Failed to update profit margin" });
    }
  });

  // Get admin's shops for management
  app.get("/api/admin/shops", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const shops = await storage.getShopsByAdmin(user.id);
      res.json(shops);
    } catch (error) {
      console.error("Failed to get admin shops:", error);
      res.status(500).json({ message: "Failed to get shops" });
    }
  });

  // Credit System API Endpoints




  // Get current system settings
  app.get("/api/admin/system-settings", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      let settings: any = {
        commissionRate: "15", // Default super admin commission
        adminProfitMargin: "15", // Default
        prizePoolPercentage: "85" // Default
      };

      // Get actual shop settings if admin has a shop
      if (user.shopId) {
        const shop = await storage.getShop(user.shopId);
        if (shop) {
          if (shop.profitMargin) {
            settings.adminProfitMargin = shop.profitMargin;
          }
          if (shop.superAdminCommission) {
            settings.commissionRate = shop.superAdminCommission;
          }
          if (shop.referralCommission) {
            settings.referralCommissionRate = shop.referralCommission;
          }
        }
      }

      res.json(settings);
    } catch (error) {
      console.error("Failed to get system settings:", error);
      res.status(500).json({ message: "Failed to get system settings" });
    }
  });

  // System settings management
  app.post("/api/admin/system-settings", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { commissionRate, adminProfitMargin, prizePoolPercentage } = req.body;

      // Update shop profit margin if admin has a shop and adminProfitMargin is provided
      if (user.shopId && adminProfitMargin !== undefined) {
        await storage.updateShop(user.shopId, {
          profitMargin: adminProfitMargin.toString()
        });
      }

      res.json({
        message: "Settings updated successfully",
        settings: { commissionRate, adminProfitMargin, prizePoolPercentage }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update system settings" });
    }
  });

  // Get game history
  app.get("/api/admin/game-history", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Admin sees all game history across all employees
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      // Get all users and their game history
      const allUsers = await storage.getUsers();
      const allHistory = [];

      for (const employee of allUsers) {
        if (employee.role === 'employee') {
          const history = await storage.getEmployeeGameHistory(employee.id, start, end);
          allHistory.push(...history);
        }
      }

      res.json(allHistory);
    } catch (error) {
      res.status(500).json({ message: "Failed to get game history" });
    }
  });

  // Create admin with account number generation
  app.post("/api/admin/create-admin", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const { name, username, password, email, shopName, referredBy } = req.body;

      if (!name || !username || !password || !shopName) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const accountNumber = await storage.generateAccountNumber();

      // Create admin user
      const admin = await storage.createUser({
        name,
        username,
        password: hashedPassword,
        email,
        role: 'admin',
        accountNumber,
        referredBy: referredBy && typeof referredBy === 'number' ? referredBy : undefined,
      });

      // Create shop for admin
      const shop = await storage.createShop({
        name: shopName,
        adminId: admin.id,
      });

      // Update admin with shop assignment
      await storage.updateUser(admin.id, { shopId: shop.id });

      res.json({
        admin: { ...admin, password: undefined },
        shop,
        accountNumber
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to create admin" });
    }
  });

  // Get profit sharing calculation for a game amount
  app.post("/api/calculate-profits", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { gameAmount, shopId } = req.body;

      if (!gameAmount || !shopId) {
        return res.status(400).json({ message: "Missing required data" });
      }

      const profits = await storage.calculateProfitSharing(gameAmount, shopId);
      res.json(profits);
    } catch (error) {
      res.status(500).json({ message: "Failed to calculate profits" });
    }
  });

  // Get referral earnings for an admin
  app.get("/api/referrals/earnings", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const referredAdmins = await storage.getAdminsByReferrer(user.id);

      // Get referral bonus transactions
      const transactions = await storage.getTransactionsByEmployee(user.id);
      const referralBonuses = transactions.filter(t => t.type === 'referral_bonus');

      const totalEarnings = referralBonuses.reduce((sum, t) => sum + parseFloat(t.amount), 0);

      res.json({
        referredAdmins: referredAdmins.length,
        totalEarnings: totalEarnings.toFixed(2),
        recentBonuses: referralBonuses.slice(0, 10)
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get referral earnings" });
    }
  });

  // Get all admins for super admin
  app.get("/api/admin/all-admins", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const admins = await storage.getUsers();
      const adminUsers = admins.filter(u => u.role === 'admin');

      // Remove passwords from response
      const safeAdmins = adminUsers.map(admin => ({
        ...admin,
        password: undefined
      }));

      res.json(safeAdmins);
    } catch (error) {
      res.status(500).json({ message: "Failed to get admins" });
    }
  });

  // Admin creates employee
  app.post("/api/admin/create-employee", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { name, username, password, email } = req.body;

      if (!name || !username || !password) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Create employee user
      const employee = await storage.createUser({
        name,
        username,
        password: hashedPassword,
        email: email || null,
        role: 'employee',
        shopId: user.shopId!,
      });

      res.json({
        employee: { ...employee, password: undefined }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to create employee" });
    }
  });

  // Get admin's employees
  app.get("/api/admin/employees", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      // For admin, return all employees with full data including passwords
      let employees;
      if (user.role === 'admin') {
        const allUsers = await storage.getUsers();
        employees = allUsers.filter(u => u.role === 'employee');
      } else {
        if (!user.shopId) {
          return res.status(400).json({ message: "Admin not assigned to a shop" });
        }
        const shopUsers = await storage.getUsersByShop(user.shopId);
        employees = shopUsers.filter(u => u.role === 'employee');
      }

      // Return employees with unencrypted passwords for admin management
      res.json(employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ message: "Failed to get employees" });
    }
  });

  // Get admin's shop statistics
  app.get("/api/admin/shop-stats", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      // For admin, return aggregate stats
      if (user.role === 'admin') {
        // Return aggregate stats across all shops
        const allShops = await storage.getShops();
        const totalRevenue = allShops.reduce((sum, shop) => sum + parseFloat(shop.totalRevenue || "0"), 0);
        const totalGames = allShops.reduce((sum, shop) => sum + (shop.totalGames || 0), 0);
        const totalPlayers = allShops.reduce((sum, shop) => sum + (shop.totalPlayers || 0), 0);

        res.json({
          totalRevenue: totalRevenue.toFixed(2),
          totalGames,
          totalPlayers
        });
      } else {
        if (!user.shopId) {
          return res.status(400).json({ message: "Admin not assigned to a shop" });
        }

        const shopStats = await storage.getShopStats(user.shopId);
        res.json(shopStats);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to get shop statistics" });
    }
  });

  // Credit management routes

  // Get credit balance
  app.get("/api/credit/balance", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role === 'admin') {
        // Admin can see their own balance
        const balance = await storage.getCreditBalance(userId);
        res.json({ balance });
      } else if (user.role === 'employee') {
        // Employee can see their admin's balance
        const adminUser = await storage.getUserByShopId(user.shopId!);
        if (!adminUser) {
          return res.status(404).json({ message: "Shop admin not found" });
        }
        const balance = adminUser.creditBalance || '0.00';
        res.json({ balance });
      } else {
        return res.status(403).json({ message: "Admin or employee access required" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to get credit balance" });
    }
  });

  // Load credit request
  // Super Admin - Admin Management
  app.get("/api/super-admin/admins", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const admins = await storage.getAdminUsers();

      // Enrich admin data with commission rates from their shops
      const enrichedAdmins = await Promise.all(
        admins.map(async (admin: any) => {
          if (admin.shopId) {
            const shop = await storage.getShop(admin.shopId);
            return {
              ...admin,
              commissionRate: shop?.superAdminCommission || '15',
            };
          }
          return {
            ...admin,
            commissionRate: '15',
          };
        })
      );

      res.json(enrichedAdmins);
    } catch (error) {
      res.status(500).json({ message: "Failed to get admin users" });
    }
  });

  app.post("/api/super-admin/admins", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const { name, username, password, shopName, commissionRate } = req.body;

      if (!name || !username || !password || !shopName) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Hash password before storing
      const hashedPassword = await bcrypt.hash(password, 10);

      const adminData = {
        name,
        username,
        password: hashedPassword,
        shopName,
        commissionRate: commissionRate || "15",
      };

      const newAdmin = await storage.createAdminUser(adminData);
      res.json(newAdmin);
    } catch (error) {
      console.error("Admin creation error:", error);
      res.status(500).json({ message: "Failed to create admin user" });
    }
  });

  app.patch("/api/super-admin/admins/:id", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const adminId = parseInt(req.params.id);
      const updates = req.body;

      console.log(`Updating admin ${adminId} with data:`, updates);

      // Get admin user for shop updates
      const adminUser = await storage.getUser(adminId);

      // If commission rate is being updated, update the shop as well
      if (updates.commissionRate !== undefined && adminUser?.shopId) {
        console.log(`Updating shop ${adminUser.shopId} with commission: ${updates.commissionRate}`);
        await storage.updateShop(adminUser.shopId, {
          superAdminCommission: updates.commissionRate.toString()
        });
        // Remove commissionRate from user updates since it's stored in shop
        delete updates.commissionRate;
      }

      // Only update user if there are remaining fields to update
      let updatedAdmin = null;
      if (Object.keys(updates).length > 0) {
        // Clean up empty strings and convert them to appropriate values
        const cleanedUpdates = { ...updates };

        // Remove empty password field (don't update if empty)
        if (cleanedUpdates.password === '') {
          delete cleanedUpdates.password;
        }

        // Remove shopName field (not a user field)
        if (cleanedUpdates.shopName !== undefined) {
          delete cleanedUpdates.shopName;
        }

        console.log(`Updating user with cleaned fields:`, cleanedUpdates);

        if (Object.keys(cleanedUpdates).length > 0) {
          updatedAdmin = await storage.updateUser(adminId, cleanedUpdates);
        } else {
          updatedAdmin = await storage.getUser(adminId);
        }
      } else {
        // If no user fields to update, just get the current user
        updatedAdmin = await storage.getUser(adminId);
      }

      console.log(`Final result:`, updatedAdmin);
      res.json(updatedAdmin);
    } catch (error) {
      console.error("Admin update error:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({ message: "Failed to update admin user", error: error.message });
    }
  });

  app.patch("/api/super-admin/admins/:id/:action", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const adminId = parseInt(req.params.id);
      const action = req.params.action;

      if (action === 'block') {
        await storage.updateUser(adminId, { isBlocked: true });
        // Block all employees under this admin
        await storage.blockEmployeesByAdmin(adminId);
      } else if (action === 'unblock') {
        await storage.updateUser(adminId, { isBlocked: false });
        // Unblock all employees under this admin
        await storage.unblockEmployeesByAdmin(adminId);
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: `Failed to ${req.params.action} admin user` });
    }
  });

  // Super Admin - Referral Management
  app.get("/api/super-admin/referral-commissions", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const commissions = await storage.getAllReferralCommissions();
      res.json(commissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to get referral commissions" });
    }
  });

  app.get("/api/super-admin/referral-settings", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const settings = await storage.getReferralSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to get referral settings" });
    }
  });

  app.patch("/api/super-admin/referral-settings", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const settings = req.body;
      await storage.updateReferralSettings(settings);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update referral settings" });
    }
  });

  // Game Management API for Employee Dashboard

  // Check winner endpoint for cartela verification
  app.post("/api/games/check-winner", async (req: Request, res) => {
    try {
      const { cartelaNumber, calledNumbers } = req.body;

      if (!cartelaNumber || !calledNumbers) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get cartela pattern from database or generate it
      let cartelaPattern;
      const cartelas = await storage.getCartelas(user.shopId || 1);
      const cartela = cartelas.find((c: any) => c.cartelaNumber === cartelaNumber);

      if (cartela && cartela.pattern) {
        cartelaPattern = cartela.pattern;
      } else {
        // Generate pattern for cartelas not in database
        cartelaPattern = getFixedPattern(cartelaNumber);
      }

      // Check for winning patterns
      const winResult = checkBingoWin(cartelaPattern, calledNumbers);

      res.json({
        isWinner: winResult.isWinner,
        winningPattern: winResult.pattern || "",
        cartelaPattern: cartelaPattern
      });
    } catch (error) {
      console.error('Error checking winner:', error);
      res.status(500).json({ error: "Failed to check winner" });
    }
  });

  // Create a new game
  app.post("/api/games", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'employee') {
        return res.status(403).json({ message: "Employee access required" });
      }

      // Check admin's credit balance before allowing game creation
      const adminUser = await storage.getUserByShopId(user.shopId!);
      if (!adminUser) {
        return res.status(404).json({ message: "Shop admin not found" });
      }

      const adminBalance = parseFloat(adminUser.creditBalance || '0.00');
      if (adminBalance < 50) {
        return res.status(400).json({
          message: `Insufficient admin credit balance. Current balance: ${adminUser.creditBalance} ETB. Minimum required: 50.00 ETB. Contact admin to add more credits.`
        });
      }

      const { entryFee } = req.body;

      const game = await storage.createGame({
        shopId: user.shopId!,
        employeeId: user.id,
        status: 'pending',
        entryFee: entryFee.toString(),
        prizePool: "0.00"
      });

      res.json(game);
    } catch (error) {
      console.error("Create game error:", error);
      res.status(500).json({ message: "Failed to create game" });
    }
  });

  // Get active game for any authenticated user in the shop
  app.get("/api/games/active", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || !['employee', 'admin', 'collector'].includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get active game by employee instead of by shop
      const activeGame = await storage.getActiveGameByEmployee(user.id);
      res.json(activeGame);
    } catch (error) {
      console.error("Get active game error:", error);
      res.status(500).json({ message: "Failed to get active game" });
    }
  });

  // Get recent completed game for reset purposes
  app.get("/api/games/recent-completed", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || !['employee', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const recentGame = await storage.getRecentCompletedGame(user.shopId!);
      res.json(recentGame);
    } catch (error) {
      console.error("Get recent completed game error:", error);
      res.status(500).json({ message: "Failed to get recent completed game" });
    }
  });

  // Add player to game with multiple cartelas
  app.post("/api/games/:gameId/players", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'employee') {
        return res.status(403).json({ message: "Employee access required" });
      }

      const gameId = parseInt(req.params.gameId);
      const { playerName, cartelaNumbers, entryFee } = req.body;

      // Add multiple cartelas for the same player
      const players = [];
      for (const cartelaNumber of cartelaNumbers) {
        const player = await storage.addGamePlayer({
          gameId,
          playerName: `${playerName} (Card ${cartelaNumber})`,
          cartelaNumbers: [cartelaNumber],
          entryFee: entryFee.toString()
        });
        players.push(player);
      }

      // Update game prize pool
      const totalAmount = cartelaNumbers.length * parseFloat(entryFee);
      await storage.updateGamePrizePool(gameId, totalAmount);

      res.json(players);
    } catch (error) {
      console.error("Add players error:", error);
      res.status(500).json({ message: "Failed to add players" });
    }
  });

  // Start game
  app.patch("/api/games/:gameId/start", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'employee') {
        return res.status(403).json({ message: "Employee access required" });
      }

      const gameId = parseInt(req.params.gameId);
      const currentGame = await storage.getGame(gameId);

      if (!currentGame) {
        return res.status(404).json({ message: "Game not found" });
      }

      if (currentGame.status === 'active' || currentGame.status === 'completed') {
        return res.status(400).json({ message: "Game already started or completed" });
      }

      const game = await storage.updateGameStatus(gameId, 'active');
      res.json(game);
    } catch (error) {
      console.error("Start game error:", error);
      res.status(500).json({ message: "Failed to start game" });
    }
  });

  // Pause/Resume game
  app.patch("/api/games/:gameId/pause", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'employee') {
        return res.status(403).json({ message: "Employee access required" });
      }

      const gameId = parseInt(req.params.gameId);
      const { isPaused } = req.body;

      const currentGame = await storage.getGame(gameId);
      if (!currentGame) {
        return res.status(404).json({ message: "Game not found" });
      }

      // Update the paused state in the database
      const newStatus = isPaused ? 'paused' : 'active';
      const game = await storage.updateGameStatus(gameId, newStatus);

      res.json({ ...game, isPaused });
    } catch (error) {
      console.error("Pause/Resume game error:", error);
      res.status(500).json({ message: "Failed to pause/resume game" });
    }
  });

  // Update called numbers
  app.patch("/api/games/:gameId/numbers", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'employee') {
        return res.status(403).json({ message: "Employee access required" });
      }

      const gameId = parseInt(req.params.gameId);
      const game = await storage.getGame(gameId);

      if (!game || (game.status !== 'active' && game.status !== 'paused')) {
        return res.status(400).json({ message: "Game not active" });
      }

      if (game.status === 'paused') {
        return res.status(400).json({ message: "Game is paused" });
      }

      // Generate next random number
      const currentNumbers = game.calledNumbers || [];
      const availableNumbers = [];

      // Generate all possible BINGO numbers (B1-B15, I16-I30, N31-N45, G46-G60, O61-O75)
      for (let i = 1; i <= 75; i++) {
        if (!currentNumbers.includes(i.toString())) {
          availableNumbers.push(i);
        }
      }

      if (availableNumbers.length === 0) {
        return res.status(400).json({ message: "All numbers have been called" });
      }

      // Pick a random number
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const newNumber = availableNumbers[randomIndex];
      const updatedNumbers = [...currentNumbers, newNumber.toString()];

      // Update game with new called number
      const updatedGame = await storage.updateGameNumbers(gameId, updatedNumbers);
      
      // Emit number called event
      const io = (global as any).io;
      if (io) {
        io.emit('number_called', {
          gameId,
          number: newNumber,
          calledNumbers: updatedNumbers,
          shopId: game.shopId
        });
      }

      res.json({
        ...updatedGame,
        calledNumbers: updatedNumbers,
        calledNumber: newNumber
      });
    } catch (error) {
      console.error("Update numbers error:", error);
      res.status(500).json({ message: "Failed to update called numbers" });
    }
  });

  // Get game players
  app.get("/api/games/:gameId/players", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const gameId = parseInt(req.params.gameId);
      const players = await storage.getGamePlayers(gameId);
      res.json(players);
    } catch (error) {
      console.error("Get players error:", error);
      res.status(500).json({ message: "Failed to get game players" });
    }
  });

  // Check winner cartela
  app.post("/api/games/:gameId/check-winner", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'employee') {
        return res.status(403).json({ message: "Employee access required" });
      }

      const gameId = parseInt(req.params.gameId);
      const { cartelaNumber, calledNumbers } = req.body;

      console.log(`Checking winner for cartela #${cartelaNumber} in shop ${user.shopId}`);
      console.log(`Called numbers:`, calledNumbers);

      // Get the cartela pattern from database instead of static data
      const cartela = await storage.getCartelaByNumber(user.shopId!, cartelaNumber);
      console.log(`Found cartela:`, cartela ? `ID ${cartela.id}, pattern: ${JSON.stringify(cartela.pattern)}` : 'Not found');

      if (!cartela) {
        console.log(`Cartela #${cartelaNumber} not found in shop ${user.shopId}`);
        return res.status(404).json({
          message: "Cartela not found",
          cartelaNumber,
          isWinner: false
        });
      }

      const cartelaPattern = cartela.pattern;
      const winResult = checkBingoWin(cartelaPattern, calledNumbers);

      console.log(`Winner check result for cartela #${cartelaNumber}:`, winResult);

      res.json({
        cartelaNumber,
        isWinner: winResult.isWinner,
        winningPattern: winResult.pattern,
        cartelaPattern: cartelaPattern,
        winningCells: winResult.winningCells || [],
        message: winResult.isWinner
          ? `Cartela Number: ${cartelaNumber}\nWinner ✓\nPattern: ${winResult.pattern}`
          : `Cartela Number: ${cartelaNumber}\nNot a Winner`
      });
    } catch (error) {
      console.error("Check winner error:", error);
      console.error("Error stack:", error.stack);
      const { cartelaNumber } = req.body || {};
      res.status(500).json({
        message: "Failed to check winner",
        cartelaNumber: cartelaNumber || "unknown",
        isWinner: false,
        error: error.message
      });
    }
  });

  // Reset/End game completely (clears all selections)
  app.patch("/api/games/:gameId/complete", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'employee') {
        return res.status(403).json({ message: "Employee access required" });
      }

      const gameId = parseInt(req.params.gameId);

      // Get game details first
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      console.log(`🔄 RESETTING GAME ${gameId} - Clearing all cartela selections`);

      // Clear all collector-marked cartelas for this shop
      await storage.resetCartelasForShop(user.shopId!);

      // Mark game as completed without winner details (reset scenario)
      const { winnerId, winnerName, winningCartela, prizeAmount } = req.body;

      // Complete the game
      const completedGame = await storage.completeGame(gameId, winnerId, prizeAmount);

      // Check if game history already exists (created by declare-winner endpoint)
      try {
        const existingHistory = await storage.getGameHistory(gameId);
        if (!existingHistory) {
          // Only create game history if it doesn't exist
          const totalCollected = parseFloat(completedGame.prizePool || "0");
          const prize = parseFloat(prizeAmount || "0");
          const adminProfit = isNaN(totalCollected) || isNaN(prize) ? 0 : totalCollected - prize;

          // Calculate total player count including both employee-selected and collector-marked cartelas
          const dbPlayerCount = await storage.getGamePlayerCount(gameId);
          const shopCartelas = await storage.getCartelasByShop(user.shopId!);
          const collectorMarkedCount = shopCartelas.filter(c => c.collectorId !== null).length;
          const totalPlayerCount = Math.max(dbPlayerCount, collectorMarkedCount);

          await storage.recordGameHistory({
            gameId,
            shopId: user.shopId!,
            employeeId: user.id,
            totalCollected: completedGame.prizePool || "0.00",
            prizeAmount: prizeAmount || "0.00",
            adminProfit: adminProfit.toString(),
            superAdminCommission: "0.00",
            playerCount: totalPlayerCount,
            winnerName,
            winningCartela
          });
        }
      } catch (historyError) {
        console.log('Game history may already exist, skipping duplicate creation');
      }

      res.json(completedGame);
    } catch (error) {
      console.error("Complete game error:", error);
      res.status(500).json({ message: "Failed to complete game" });
    }
  });

  // Employee Game Management API Endpoints

  // Get active game for employee


  // Create new game
  app.post("/api/games", async (req: Request, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'employee') {
        return res.status(403).json({ message: "Employee access required" });
      }

      const { entryFee, selectedCartelas } = req.body;
      if (!entryFee) {
        return res.status(400).json({ message: "Entry fee is required" });
      }

      // Check employee's credit balance first
      const employeeBalance = parseFloat(user.creditBalance || '0');
      const totalCost = (selectedCartelas || []).length * parseFloat(entryFee);

      if (employeeBalance < totalCost) {
        return res.status(400).json({
          message: `Insufficient employee credit balance. You have ${employeeBalance.toFixed(2)} ETB but need ${totalCost.toFixed(2)} ETB to start this game.`,
          balance: employeeBalance.toFixed(2),
          required: totalCost.toFixed(2),
          cartelas: (selectedCartelas || []).length,
          entryFee: parseFloat(entryFee)
        });
      }

      // Check admin's credit balance before allowing game creation
      const adminUser = await storage.getUserByShopId(user.shopId!);
      if (!adminUser) {
        return res.status(400).json({ message: "Shop admin not found" });
      }

      const adminBalance = parseFloat(adminUser.creditBalance || '0');
      const minimumBalance = 50; // ETB

      if (adminBalance < minimumBalance) {
        return res.status(400).json({
          message: `Insufficient admin credit balance. Admin has ${adminBalance.toFixed(2)} ETB but needs at least ${minimumBalance} ETB to start a game.`,
          balance: adminBalance.toFixed(2),
          required: minimumBalance
        });
      }

      const gameData = {
        shopId: user.shopId!,
        employeeId: userId,
        entryFee: entryFee.toString(),
        status: 'pending' as const,
        calledNumbers: [],
        prizePool: '0.00'
      };

      const game = await storage.createGame(gameData);
      res.json(game);
    } catch (error) {
      console.error("Game creation error:", error);
      res.status(500).json({ message: "Failed to create game" });
    }
  });

  // Add players to game
  app.post("/api/games/:gameId/players", async (req: Request, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        console.log('❌ ADD PLAYERS: Not authenticated');
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'employee') {
        console.log('❌ ADD PLAYERS: Employee access required');
        return res.status(403).json({ message: "Employee access required" });
      }

      const gameId = parseInt(req.params.gameId);
      const { playerName, cartelaNumbers, entryFee } = req.body;

      console.log('🎯 ADD PLAYERS API CALLED:', {
        gameId,
        playerName,
        cartelaNumbers,
        entryFee,
        cartelasCount: cartelaNumbers?.length
      });

      if (!playerName || !cartelaNumbers || !Array.isArray(cartelaNumbers) || cartelaNumbers.length === 0) {
        console.log('❌ ADD PLAYERS: Invalid request data');
        return res.status(400).json({ message: "Player name and cartelaNumbers are required" });
      }

      // Add each cartela as a separate player entry
      const players = [];
      console.log('📝 Creating player records for', cartelaNumbers.length, 'cartelas');

      for (const cartelaNumber of cartelaNumbers) {
        const playerData = {
          gameId,
          playerName: `${playerName} #${cartelaNumber}`,
          cartelaNumbers: [cartelaNumber],
          entryFee: entryFee.toString()
        };

        console.log('📝 Creating player record:', playerData);
        const player = await storage.addGamePlayer(playerData);
        players.push(player);
        console.log('✅ Player record created:', player.id);
      }

      // Update game prize pool
      const totalAmount = cartelaNumbers.length * parseFloat(entryFee);
      await storage.updateGamePrizePool(gameId, totalAmount);

      console.log('✅ ADD PLAYERS SUCCESS:', {
        playersCreated: players.length,
        totalAmount,
        gameId
      });

      res.json(players);
    } catch (error) {
      console.error('❌ ADD PLAYERS ERROR:', error);
      res.status(500).json({ message: "Failed to add players" });
    }
  });

  // Get game players
  app.get("/api/games/:gameId/players", async (req: Request, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const gameId = parseInt(req.params.gameId);
      const players = await storage.getGamePlayers(gameId);
      res.json(players);
    } catch (error) {
      res.status(500).json({ message: "Failed to get game players" });
    }
  });

  // Start game
  app.patch("/api/games/:gameId/start", async (req: Request, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'employee') {
        return res.status(403).json({ message: "Employee access required" });
      }

      const gameId = parseInt(req.params.gameId);
      const game = await storage.updateGameStatus(gameId, 'active');
      res.json(game);
    } catch (error) {
      res.status(500).json({ message: "Failed to start game" });
    }
  });

  // Update called numbers
  app.patch("/api/games/:gameId/numbers", async (req: Request, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const gameId = parseInt(req.params.gameId);
      const { calledNumbers } = req.body;

      if (!Array.isArray(calledNumbers)) {
        return res.status(400).json({ message: "Called numbers must be an array" });
      }

      const game = await storage.updateGameNumbers(gameId, calledNumbers);
      res.json(game);
    } catch (error) {
      res.status(500).json({ message: "Failed to update called numbers" });
    }
  });



  // Declare winner with complete financial data
  app.post("/api/games/:gameId/declare-winner", async (req: Request, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'employee') {
        return res.status(403).json({ message: "Employee access required" });
      }

      const gameId = parseInt(req.params.gameId);
      const { winnerCartelaNumber, totalPlayers, entryFeePerPlayer, allCartelaNumbers, calledNumbers } = req.body;

      console.log('🎯 COMPREHENSIVE GAME RECORDING - Game ' + gameId + ', Winner ' + winnerCartelaNumber + ', Cartela ' + winnerCartelaNumber);

      if (!winnerCartelaNumber) {
        console.log('❌ No winnerCartelaNumber provided for game ' + gameId);
        return res.status(400).json({ message: "Winner cartela number is required" });
      }

      // Verify if this cartela is actually a winner using database data
      const cartela = await storage.getCartelaByNumber(user.shopId!, winnerCartelaNumber);
      if (!cartela) {
        console.log('❌ CARTELA NOT FOUND:', { cartelaNumber: winnerCartelaNumber, shopId: user.shopId });
        return res.status(404).json({
          message: "Cartela not found",
          cartelaNumber: winnerCartelaNumber
        });
      }

      const cartelaPattern = cartela.pattern;
      const winResult = checkBingoWin(cartelaPattern, calledNumbers);

      if (!winResult.isWinner) {
        console.log('❌ WINNER VERIFICATION FAILED:', { cartelaNumber: winnerCartelaNumber, winResult });
        return res.status(400).json({
          message: "This cartela is not a winner",
          cartelaNumber: winnerCartelaNumber,
          isWinner: false
        });
      }

      console.log('✅ WINNER VERIFIED - Game ' + gameId + ', Winner ' + winnerCartelaNumber + ', Pattern: ' + winResult.pattern);

      // Get existing players for this game to calculate accurate financial data
      const existingPlayers = await storage.getGamePlayers(gameId);
      console.log('🔍 EXISTING PLAYERS IN GAME:', {
        gameId,
        playerCount: existingPlayers.length,
        players: existingPlayers.map(p => ({ id: p.id, cartelas: p.cartelaNumbers, fee: p.entryFee }))
      });

      // Use frontend-provided data for accurate calculations - prioritize actual data
      const totalCartelas = allCartelaNumbers ? allCartelaNumbers.length : (totalPlayers || 0);
      const actualEntryFee = parseFloat(entryFeePerPlayer?.toString() || '0');
      const totalCollected = totalCartelas * actualEntryFee;

      console.log('📊 CORRECTED CALCULATION:', {
        totalCartelas,
        actualEntryFee,
        totalCollected,
        playerRecords: existingPlayers.length
      });

      // Find or create winner player record
      let winnerPlayer = existingPlayers.find(p => p.cartelaNumbers.includes(winnerCartelaNumber));
      if (!winnerPlayer) {
        // Create new player record only if not found
        winnerPlayer = await storage.addGamePlayer({
          gameId,
          playerName: `Player ${winnerCartelaNumber}`,
          cartelaNumbers: [winnerCartelaNumber],
          entryFee: actualEntryFee.toString(),
          isWinner: true
        });
        console.log('⚠️ Created new player record for winner - this should not happen in normal flow');
      } else {
        // Mark existing player as winner
        winnerPlayer.isWinner = true;
        console.log('✅ Found existing player record for winner cartela #' + winnerCartelaNumber);
      }

      // Get shop data to fetch correct profit margin
      const shop = await storage.getShop(user.shopId!);
      const shopProfitMargin = shop?.profitMargin ? parseFloat(shop.profitMargin) / 100 : 0.10; // Default to 10%
      const adminProfit = totalCollected * shopProfitMargin;
      const prizeAmount = totalCollected * (1 - shopProfitMargin); // Use same calculation as frontend
      const superAdminCommissionRate = shop?.superAdminCommission ? parseFloat(shop.superAdminCommission) / 100 : 0.20;
      const superAdminCommission = adminProfit * superAdminCommissionRate;

      console.log('💰 FINANCIAL CALCULATION:', {
        totalCollected,
        totalCartelas,
        entryFeePerPlayer: actualEntryFee.toString(),
        allPlayerDetails: existingPlayers.map(p => ({
          playerId: p.id,
          playerName: p.playerName,
          cartelaNumbers: p.cartelaNumbers,
          amount: parseFloat(p.entryFee)
        }))
      });

      console.log('🧮 PROFIT CALCULATIONS:', {
        totalCollected,
        profitMargin: (shopProfitMargin * 100) + '%',
        adminProfit,
        prizeAmount,
        superAdminCommissionRate: (superAdminCommissionRate * 100) + '%',
        superAdminCommission,
        calculationMethod: 'totalCollected * (1 - shopProfitMargin)'
      });

      // Update game status to completed
      await storage.updateGameStatus(gameId, 'completed');

      // Create comprehensive game history record
      console.log('💾 CREATING COMPREHENSIVE GAME HISTORY RECORD...');
      const gameHistory = {
        gameId,
        shopId: user.shopId!,
        employeeId: userId,
        totalCollected: totalCollected.toFixed(2),
        prizeAmount: prizeAmount.toFixed(2),
        adminProfit: adminProfit.toFixed(2),
        superAdminCommission: superAdminCommission.toFixed(2),
        playerCount: totalCartelas, // Use actual cartela count from frontend
        winnerName: winnerPlayer.playerName || `Player ${winnerCartelaNumber}`,
        winningCartela: `#${winnerCartelaNumber}`,
        completedAt: new Date()
      };

      const historyRecord = await storage.recordGameHistory(gameHistory);
      console.log('✅ GAME HISTORY CREATED:', { historyId: historyRecord.id, gameId, uniqueRecord: true });

      // Note: Shop revenue tracking handled by game history record

      // Actually save super admin commission to database
      if (superAdminCommission > 0) {
        try {
          // Get current EAT date for filtering
          const now = new Date();
          const eatDate = new Date(now.getTime() + 3 * 60 * 60 * 1000); // Add 3 hours for EAT
          const dateEAT = eatDate.toISOString().split('T')[0];

          await storage.createSuperAdminRevenue({
            adminId: user.shopId || user.id,
            adminName: user.name || 'Unknown Admin',
            shopId: user.shopId || 1,
            shopName: `Shop ${user.shopId || 'Unknown'}`,
            gameId: gameId,
            revenueType: 'game_commission',
            amount: superAdminCommission.toFixed(2),
            commissionRate: '20.00',
            sourceAmount: adminProfit.toFixed(2),
            description: `Game ${gameId} commission from ${user.name || 'Admin'}`,
            dateEAT: dateEAT
          });
          console.log('✅ Super Admin revenue saved to database: ' + superAdminCommission.toFixed(2) + ' ETB from game ' + gameId);
        } catch (revenueError) {
          console.error('❌ Failed to save super admin revenue:', revenueError);
        }
      }

      // Log super admin commission
      console.log('✅ Super Admin revenue logged: ' + superAdminCommission.toFixed(2) + ' ETB from game ' + gameId);
      console.log('✅ Super Admin revenue logged from game ' + gameId + ': ' + superAdminCommission + ' ETB');

      // Deduct the commission from admin's credit balance
      if (superAdminCommission > 0) {
        try {
          // Get the shop admin for this game
          const shopAdmin = await storage.getUserByShopId(user.shopId!);
          if (shopAdmin && shopAdmin.role === 'admin') {
            const currentBalance = parseFloat(shopAdmin.creditBalance || '0');
            const newBalance = Math.max(0, currentBalance - superAdminCommission);

            await storage.updateUserBalance(shopAdmin.id, newBalance.toFixed(2));
            console.log(`💰 COMMISSION DEDUCTED: ${superAdminCommission.toFixed(2)} ETB from admin ${shopAdmin.name} (${currentBalance.toFixed(2)} → ${newBalance.toFixed(2)} ETB)`);
          }
        } catch (balanceError) {
          console.error('❌ Failed to deduct commission from admin balance:', balanceError);
        }
      }

      const game = await storage.getGame(gameId);
      res.json({
        game,
        winner: winnerPlayer,
        financialData: {
          totalCollected: totalCollected.toFixed(2),
          prizeAmount: prizeAmount.toFixed(2),
          adminProfit: adminProfit.toFixed(2),
          superAdminCommission: superAdminCommission.toFixed(2)
        },
        isWinner: true,
        cartelaNumber: winnerCartelaNumber
      });
    } catch (error) {
      console.error("Declare winner error:", error);
      res.status(500).json({ message: "Failed to declare winner" });
    }
  });

  // Complete game (with manual winner verification)
  app.patch("/api/games/:gameId/complete", async (req: Request, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'employee') {
        return res.status(403).json({ message: "Employee access required" });
      }

      const gameId = parseInt(req.params.gameId);
      const { winnerId, winnerName, winningCartela, prizeAmount } = req.body;

      if (!winnerId || !winnerName || !winningCartela || !prizeAmount) {
        return res.status(400).json({ message: "Winner details are required" });
      }

      // Complete the game
      const game = await storage.completeGame(gameId, winnerId, prizeAmount);

      // Record game history
      const gameHistory = {
        gameId,
        shopId: user.shopId!,
        employeeId: userId,
        totalCollected: game.prizePool,
        prizeAmount,
        adminProfit: (parseFloat(game.prizePool) - parseFloat(prizeAmount)).toString(),
        superAdminCommission: '0.00',
        playerCount: await storage.getGamePlayerCount(gameId),
        winnerName,
        winningCartela,
        completedAt: new Date()
      };

      await storage.recordGameHistory(gameHistory);

      // Process game profits
      await storage.processGameProfits(gameId, game.prizePool);

      res.json(game);
    } catch (error) {
      console.error("Complete game error:", error);
      res.status(500).json({ message: "Failed to complete game" });
    }
  });


  app.post("/api/cartelas/reset", async (req: Request, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || !['employee', 'admin', 'collector'].includes(user.role)) {
        return res.status(403).json({ message: "Employee, admin, or collector access required" });
      }

      const shopId = req.body.shopId || user.shopId;

      // Reset all marked cartelas in the shop to available state
      await storage.resetShopCartelas(shopId);

      // Only reset games if user is employee or admin (not collector)
      if (user.role === 'employee' || user.role === 'admin') {
        // Reset any games in the shop (including completed ones after winner declaration)
        const activeGame = await storage.getActiveGameByEmployee(user.id);

        // If no active game found, check for recently completed games (within last hour)
        let gameToReset = activeGame;
        if (!activeGame) {
          const recentGames = await storage.getRecentGamesByShop(shopId, 1); // Get last 1 hour
          const completedGame = recentGames.find(g => g.status === 'completed');
          if (completedGame) {
            console.log(`🔄 RESET: Found completed game ${completedGame.id} to reset`);
            gameToReset = completedGame;
          }
        }

        if (gameToReset) {
          console.log(`🔄 RESET: Archiving old game ${gameToReset.id} and creating fresh game for shop ${shopId}`);

          // Archive the old game by setting it to completed (if not already)
          if (gameToReset.status !== 'completed') {
            await storage.updateGameStatus(gameToReset.id, 'completed');
          }

          // Create a completely new game with fresh ID
          const newGame = await storage.createGame({
            shopId: shopId,
            employeeId: userId,
            status: 'waiting',
            prizePool: '0.00',
            entryFee: gameToReset.entryFee || '20.00', // Keep the same entry fee
            calledNumbers: [],
            winnerId: null,
            startedAt: null,
            completedAt: null
          });

          console.log(`🔄 RESET SUCCESS: Created fresh game ${newGame.id} (old game ${gameToReset.id} archived)`);
        } else {
          console.log(`🔄 RESET: No active or recent completed games found for shop ${shopId}`);
        }
        res.json({ message: "All cartelas and game state reset successfully" });
      } else {
        // Collector only resets cartelas, not games
        res.json({ message: "All cartelas reset successfully" });
      }
    } catch (error) {
      console.error("Error resetting cartelas:", error);
      res.status(500).json({ error: "Failed to reset cartelas" });
    }
  });

  // Employee routes for managing collectors
  app.post("/api/employees/create-collector", async (req: Request, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'employee') {
        return res.status(403).json({ message: "Employee access required" });
      }

      const { username, password, name, email } = req.body;

      if (!username || !password || !name) {
        return res.status(400).json({ message: "Username, password, and name required" });
      }

      // Create collector under this employee
      const collectorData = {
        username,
        password: await bcrypt.hash(password, 12),
        name,
        email: email || null,
        role: 'collector' as const,
        shopId: user.shopId!,
        supervisorId: user.id, // Set employee as supervisor
        isBlocked: false,
        creditBalance: "0.00",
        accountNumber: null,
        referredBy: null,
        commissionRate: "0.00"
      };

      const collector = await storage.createUser(collectorData);

      res.json({
        success: true,
        collector: {
          id: collector.id,
          username: collector.username,
          name: collector.name,
          role: collector.role
        }
      });
    } catch (error) {
      console.error("Error creating collector:", error);
      if (error.message?.includes('duplicate key')) {
        res.status(400).json({ message: "Username already exists" });
      } else {
        res.status(500).json({ message: "Failed to create collector" });
      }
    }
  });

  app.get("/api/employees/:employeeId/collectors", async (req: Request, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const employeeId = parseInt(req.params.employeeId);
      const collectors = await storage.getCollectorsByEmployee(employeeId);

      res.json(collectors);
    } catch (error) {
      console.error("Error getting collectors:", error);
      res.status(500).json({ message: "Failed to get collectors" });
    }
  });



  // Get comprehensive shop analytics
  app.get("/api/analytics/shop/:shopId", async (req: Request, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const shopId = parseInt(req.params.shopId);
      const { startDate, endDate } = req.query;

      // Get basic shop stats
      const shopStats = await storage.getShopStats(shopId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      // Get game history with profit breakdown
      const gameHistory = await storage.getGameHistory(shopId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      // Calculate detailed profit breakdown
      const totalRevenue = gameHistory.reduce((sum, game) => sum + parseFloat(game.totalCollected || "0"), 0);
      const totalPrizes = gameHistory.reduce((sum, game) => sum + parseFloat(game.prizeAmount || "0"), 0);
      const adminProfit = gameHistory.reduce((sum, game) => sum + parseFloat(game.adminProfit || "0"), 0);
      const superAdminCommission = gameHistory.reduce((sum, game) => sum + parseFloat(game.superAdminCommission || "0"), 0);

      // Get employee performance
      const employees = await storage.getUsersByShop(shopId);
      const employeeStats = await Promise.all(
        employees.filter(emp => emp.role === 'employee').map(async (emp) => {
          const empStats = await storage.getEmployeeStats(emp.id,
            startDate ? new Date(startDate as string) : undefined,
            endDate ? new Date(endDate as string) : undefined
          );
          const empHistory = await storage.getEmployeeGameHistory(emp.id,
            startDate ? new Date(startDate as string) : undefined,
            endDate ? new Date(endDate as string) : undefined
          );
          return {
            employee: emp,
            stats: empStats,
            games: empHistory.length,
            totalCollected: empHistory.reduce((sum, game) => sum + parseFloat(game.totalCollected || "0"), 0)
          };
        })
      );

      // Calculate profit margins
      const profitMargin = totalRevenue > 0 ? ((adminProfit / totalRevenue) * 100) : 0;
      const prizePercentage = totalRevenue > 0 ? ((totalPrizes / totalRevenue) * 100) : 0;

      res.json({
        basicStats: shopStats,
        profitBreakdown: {
          totalRevenue: totalRevenue.toFixed(2),
          totalPrizes: totalPrizes.toFixed(2),
          adminProfit: adminProfit.toFixed(2),
          superAdminCommission: superAdminCommission.toFixed(2),
          profitMargin: profitMargin.toFixed(2),
          prizePercentage: prizePercentage.toFixed(2)
        },
        employeePerformance: employeeStats,
        gameHistory: gameHistory.slice(0, 20), // Latest 20 games
        totalGames: gameHistory.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get shop analytics" });
    }
  });

  // Get profit distribution analytics
  app.get("/api/analytics/profit-distribution", async (req: Request, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const { startDate, endDate } = req.query;

      // Get all shops
      const shops = await storage.getShops();

      const shopAnalytics = await Promise.all(
        shops.map(async (shop) => {
          const gameHistory = await storage.getGameHistory(shop.id,
            startDate ? new Date(startDate as string) : undefined,
            endDate ? new Date(endDate as string) : undefined
          );

          const totalRevenue = gameHistory.reduce((sum, game) => sum + parseFloat(game.totalCollected || "0"), 0);
          const adminProfit = gameHistory.reduce((sum, game) => sum + parseFloat(game.adminProfit || "0"), 0);
          const superAdminCommission = gameHistory.reduce((sum, game) => sum + parseFloat(game.superAdminCommission || "0"), 0);

          return {
            shop,
            totalRevenue: totalRevenue.toFixed(2),
            adminProfit: adminProfit.toFixed(2),
            superAdminCommission: superAdminCommission.toFixed(2),
            gameCount: gameHistory.length
          };
        })
      );

      // Calculate totals
      const totalSystemRevenue = shopAnalytics.reduce((sum, shop) => sum + parseFloat(shop.totalRevenue), 0);
      const totalAdminProfits = shopAnalytics.reduce((sum, shop) => sum + parseFloat(shop.adminProfit), 0);
      const totalSuperAdminCommissions = shopAnalytics.reduce((sum, shop) => sum + parseFloat(shop.superAdminCommission), 0);

      res.json({
        shopAnalytics,
        systemTotals: {
          totalRevenue: totalSystemRevenue.toFixed(2),
          totalAdminProfits: totalAdminProfits.toFixed(2),
          totalSuperAdminCommissions: totalSuperAdminCommissions.toFixed(2),
          totalGames: shopAnalytics.reduce((sum, shop) => sum + shop.gameCount, 0)
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get profit distribution analytics" });
    }
  });

  // Get financial trends
  app.get("/api/analytics/trends", async (req: Request, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { shopId, period = 'week' } = req.query;

      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case 'week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(endDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(endDate.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      let gameHistory;
      if (user.role === 'super_admin' && !shopId) {
        // Get all games for super admin
        const shops = await storage.getShops();
        gameHistory = [];
        for (const shop of shops) {
          const shopGames = await storage.getGameHistory(shop.id, startDate, endDate);
          gameHistory.push(...shopGames);
        }
      } else {
        // Get games for specific shop
        const targetShopId = shopId ? parseInt(shopId as string) : user.shopId!;
        gameHistory = await storage.getGameHistory(targetShopId, startDate, endDate);
      }

      // Group by day for trends
      const dailyData = new Map();
      gameHistory.forEach(game => {
        const date = new Date(game.completedAt).toISOString().split('T')[0];
        if (!dailyData.has(date)) {
          dailyData.set(date, {
            date,
            revenue: 0,
            games: 0,
            prizes: 0,
            profit: 0
          });
        }
        const day = dailyData.get(date);
        day.revenue += parseFloat(game.totalCollected || "0");
        day.games += 1;
        day.prizes += parseFloat(game.prizeAmount || "0");
        day.profit += parseFloat(game.adminProfit || "0");
      });

      const trends = Array.from(dailyData.values()).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      res.json({
        trends,
        summary: {
          totalRevenue: trends.reduce((sum, day) => sum + day.revenue, 0).toFixed(2),
          totalGames: trends.reduce((sum, day) => sum + day.games, 0),
          totalPrizes: trends.reduce((sum, day) => sum + day.prizes, 0).toFixed(2),
          totalProfit: trends.reduce((sum, day) => sum + day.profit, 0).toFixed(2),
          averageDailyRevenue: trends.length > 0 ? (trends.reduce((sum, day) => sum + day.revenue, 0) / trends.length).toFixed(2) : "0.00"
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get financial trends" });
    }
  });

  // Get employee performance analytics
  app.get("/api/analytics/employee-performance", async (req: Request, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { shopId, startDate, endDate } = req.query;

      let employees;
      if (user.role === 'admin' && !shopId) {
        // Get all employees for admin
        const allUsers = await storage.getUsers();
        employees = allUsers.filter(u => u.role === 'employee');
      } else {
        // Get employees for specific shop
        const targetShopId = shopId ? parseInt(shopId as string) : user.shopId!;
        employees = await storage.getUsersByShop(targetShopId);
        employees = employees.filter(emp => emp.role === 'employee');
      }

      const performanceData = await Promise.all(
        employees.map(async (emp) => {
          const empStats = await storage.getEmployeeStats(emp.id,
            startDate ? new Date(startDate as string) : undefined,
            endDate ? new Date(endDate as string) : undefined
          );

          const empHistory = await storage.getEmployeeGameHistory(emp.id,
            startDate ? new Date(startDate as string) : undefined,
            endDate ? new Date(endDate as string) : undefined
          );

          const totalRevenue = empHistory.reduce((sum, game) => sum + parseFloat(game.totalCollected || "0"), 0);
          const totalPrizes = empHistory.reduce((sum, game) => sum + parseFloat(game.prizeAmount || "0"), 0);
          const avgGameValue = empHistory.length > 0 ? totalRevenue / empHistory.length : 0;

          return {
            employee: {
              id: emp.id,
              name: emp.name,
              username: emp.username,
              shopId: emp.shopId
            },
            stats: empStats,
            performance: {
              totalGames: empHistory.length,
              totalRevenue: totalRevenue.toFixed(2),
              totalPrizes: totalPrizes.toFixed(2),
              averageGameValue: avgGameValue.toFixed(2),
              efficiency: empHistory.length > 0 ? ((totalRevenue - totalPrizes) / totalRevenue * 100).toFixed(2) : "0.00"
            }
          };
        })
      );

      // Sort by total revenue
      performanceData.sort((a, b) => parseFloat(b.performance.totalRevenue) - parseFloat(a.performance.totalRevenue));

      res.json(performanceData);
    } catch (error) {
      res.status(500).json({ message: "Failed to get employee performance analytics" });
    }
  });

  // Export analytics data
  app.get("/api/analytics/export", async (req: Request, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { shopId, startDate, endDate, type = 'games' } = req.query;

      let data;
      if (type === 'games') {
        if (user.role === 'admin' && !shopId) {
          const shops = await storage.getShops();
          data = [];
          for (const shop of shops) {
            const shopGames = await storage.getGameHistory(shop.id,
              startDate ? new Date(startDate as string) : undefined,
              endDate ? new Date(endDate as string) : undefined
            );
            data.push(...shopGames.map(game => ({ ...game, shopName: shop.name })));
          }
        } else {
          const targetShopId = shopId ? parseInt(shopId as string) : user.shopId!;
          data = await storage.getGameHistory(targetShopId,
            startDate ? new Date(startDate as string) : undefined,
            endDate ? new Date(endDate as string) : undefined
          );
        }
      }

      res.json({
        data,
        exportedAt: new Date().toISOString(),
        filters: { shopId, startDate, endDate, type }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to export analytics data" });
    }
  });

  // Get admin shop stats with commission rate for live updates
  app.get("/api/admin/shop-stats", async (req: Request, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'admin' && user.role !== 'employee')) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get shop information with commission rate
      const shop = user.shopId ? await storage.getShop(user.shopId) : null;
      const commissionRate = shop?.superAdminCommission || "30";

      const shopStats = {
        commissionRate,
        shopId: user.shopId,
        shopName: shop?.name || "Unknown Shop",
        lastUpdated: new Date().toISOString()
      };

      res.json(shopStats);
    } catch (error) {
      console.error('Error fetching shop stats:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get admin transactions
  app.get("/api/transactions/admin", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Get all transactions for admin view
      const transactions = await storage.getAllTransactions();
      
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching admin transactions:", error);
      res.status(500).json({ message: "Failed to get transactions" });
    }
  });

  // Delete employee endpoint
  app.delete("/api/admin/employees/:id", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const employeeId = parseInt(req.params.id);
      if (isNaN(employeeId)) {
        return res.status(400).json({ message: "Invalid employee ID" });
      }

      const deleted = await storage.deleteUser(employeeId);
      if (deleted) {
        res.json({ message: "Employee deleted successfully" });
      } else {
        res.status(404).json({ message: "Employee not found" });
      }
    } catch (error) {
      console.error("Error deleting employee:", error);
      res.status(500).json({ message: "Failed to delete employee" });
    }
  });

  // Mount cartela routes
  const { cartelasRouter } = await import("./cartela");
  app.use("/api/cartelas", cartelasRouter);

  return { server: httpServer };
}

