import type { Express, Request, Response } from "express";
import bcrypt from "bcrypt";
import { User, Shop, Game, Transaction, Cartela, CreditLoad } from "@shared/mongodb-schema";
import { connectMongoDB } from "../db/mongodb";

// Extend Express Request to include session
declare module 'express-serve-static-core' {
  interface Request {
    session: any;
  }
}

export function registerMongoDBRoutes(app: Express): void {
  // Initialize MongoDB connection
  connectMongoDB().catch(console.error);

  // Authentication routes
  app.post("/api/mongodb/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      console.log(`MongoDB - Database user lookup: ${username}`);

      const user = await User.findOne({ username }).populate('shopId');

      if (!user) {
        console.log("MongoDB - Database user found: none");
        return res.status(401).json({ message: "Invalid credentials" });
      }

      console.log(`MongoDB - Database user found: ${user.username} (id: ${user._id})`);

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Store user in session
      req.session.user = {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        shopId: user.shopId?._id,
        creditBalance: user.creditBalance
      };

      const userResponse = {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        isBlocked: user.isBlocked,
        shopId: user.shopId?._id,
        creditBalance: user.creditBalance.toString(),
        accountNumber: user.accountNumber,
        commissionRate: user.commissionRate.toString(),
        createdAt: user.createdAt
      };

      res.json({ user: userResponse });
    } catch (error) {
      console.error("MongoDB login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/mongodb/auth/me", async (req: Request, res: Response) => {
    try {
      if (!req.session.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await User.findById(req.session.user.id).populate('shopId');
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const userResponse = {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        isBlocked: user.isBlocked,
        shopId: user.shopId?._id,
        supervisorId: user.supervisorId,
        creditBalance: user.creditBalance.toString(),
        accountNumber: user.accountNumber,
        referredBy: user.referredBy,
        commissionRate: user.commissionRate.toString(),
        createdAt: user.createdAt
      };

      res.json({ user: userResponse });
    } catch (error) {
      console.error("MongoDB auth/me error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/mongodb/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Super Admin routes
  app.get("/api/mongodb/super-admin/admins", async (req: Request, res: Response) => {
    try {
      if (!req.session.user || req.session.user.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const admins = await User.find({ role: 'admin' }).populate('shopId');

      const adminList = admins.map(admin => ({
        id: admin._id,
        username: admin.username,
        name: admin.name,
        email: admin.email,
        isBlocked: admin.isBlocked,
        shopId: admin.shopId?._id,
        shopName: (admin.shopId as any)?.name,
        creditBalance: admin.creditBalance.toString(),
        accountNumber: admin.accountNumber,
        commissionRate: admin.commissionRate.toString(),
        createdAt: admin.createdAt
      }));

      res.json(adminList);
    } catch (error) {
      console.error("MongoDB get admins error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/mongodb/super-admin/admins", async (req: Request, res: Response) => {
    try {
      if (!req.session.user || req.session.user.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const { username, password, name, email, shopName } = req.body;

      // Check if username already exists
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Generate account number
      const accountNumber = `BGO${Math.floor(Math.random() * 1000000000)}`;

      // Create shop first
      const shop = new Shop({
        name: shopName,
        adminId: null // Will be updated after user creation
      });
      await shop.save();

      // Create admin user
      const admin = new User({
        username,
        password: hashedPassword,
        role: 'admin',
        name,
        email,
        shopId: shop._id,
        accountNumber,
        commissionRate: 25
      });
      await admin.save();

      // Update shop with admin ID
      shop.adminId = admin._id as any;
      await shop.save();

      const adminResponse = {
        id: admin._id,
        username: admin.username,
        name: admin.name,
        email: admin.email,
        shopId: shop._id,
        shopName: shop.name,
        accountNumber: admin.accountNumber,
        commissionRate: admin.commissionRate.toString(),
        createdAt: admin.createdAt
      };

      res.json(adminResponse);
    } catch (error) {
      console.error("MongoDB create admin error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Shop and game routes
  app.get("/api/mongodb/shops", async (req: Request, res: Response) => {
    try {
      const shops = await Shop.find().populate('adminId', 'name username email');
      res.json(shops);
    } catch (error) {
      console.error("MongoDB get shops error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/mongodb/games/:shopId", async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;
      const games = await Game.find({ shopId }).populate('employeeId', 'name username');
      res.json(games);
    } catch (error) {
      console.error("MongoDB get games error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Status endpoint
  app.get("/api/mongodb/status", async (req: Request, res: Response) => {
    try {
      const userCount = await User.countDocuments();
      const shopCount = await Shop.countDocuments();
      const gameCount = await Game.countDocuments();

      res.json({
        status: "Connected to MongoDB",
        database: "bingomaster",
        collections: {
          users: userCount,
          shops: shopCount,
          games: gameCount
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("MongoDB status error:", error);
      res.status(500).json({ message: "MongoDB connection error" });
    }
  });

  console.log("🍃 MongoDB routes registered successfully");
}