// @ts-nocheck
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import * as os from "os";
import { storage } from "../../storage/storage";
import { adminStorage } from "../../storage/admin-storage";
import UltimateMachineIdGenerator from "../lib/ultimate-machine-id";
import { encryptData, decryptData, signBalance, verifyBalance, generateKeyPair } from "../lib/crypto";

// Initialize ultimate generator
const ultimateGenerator = UltimateMachineIdGenerator.getInstance();

const { privateKey: SYSTEM_PRIVATE_KEY, publicKey: SYSTEM_PUBLIC_KEY } = generateKeyPair();

// ─── LOGIN ──────────────────────────────────────────────────────────
export async function login(req: Request, res: Response) {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password required" });
        }

        console.log(`Login attempt for username: ${username}, password: ${password}`);

        const user = await storage.getUserByUsername(username);
        if (!user) {
            console.log(`User not found: ${username}`);

            // Check if user exists in admin tracking database
            const adminUser = await adminStorage.getAdminUserByUsername(username);
            if (adminUser && adminUser.username === 'admin') {
                console.log(`Found admin user in tracking database:`, { username: adminUser.username, password: adminUser.password });

                const isHashedPassword = adminUser.password.startsWith('$2b$');
                let isValidPassword = false;

                if (isHashedPassword) {
                    isValidPassword = await bcrypt.compare(password, adminUser.password);
                } else {
                    isValidPassword = password === adminUser.password;
                }

                if (isValidPassword) {
                    const sessionUser = {
                        id: adminUser.id,
                        username: adminUser.username,
                        role: 'admin',
                        name: adminUser.name,
                        shopId: adminUser.shopId,
                        accountNumber: adminUser.accountNumber,
                        isBlocked: adminUser.isBlocked
                    };

                    req.session.userId = adminUser.id;
                    req.session.user = sessionUser;
                    req.session.isAdmin = true;

                    await new Promise((resolve) => {
                        req.session.save((err) => { resolve(); });
                    });

                    return res.json({
                        message: "Login successful",
                        user: sessionUser,
                        isAdmin: true
                    });
                }
            }

            return res.status(401).json({ message: "Invalid credentials" });
        }

        console.log(`Found user:`, { username: user.username, password: user.password, role: user.role });

        const isHashedPassword = user.password.startsWith('$2b$');
        let isValidPassword = false;

        if (isHashedPassword) {
            isValidPassword = await bcrypt.compare(password, user.password);
        } else {
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

        req.session.userId = user.id;
        req.session.user = user;

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
}

// ─── REGISTER VIA FILE ──────────────────────────────────────────────
export async function registerFile(req: Request, res: Response) {
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
            name: userData.fullName || userData.name,
            shopId: userData.shopId,
            accountNumber: userData.accountNumber,
            balance: userData.initialBalance || "0.00",
            isBlocked: false
        });

        req.session.userId = newUser.id;
        req.session.user = newUser;

        await new Promise((resolve) => {
            req.session.save((err) => { resolve(); });
        });

        res.json({
            message: "Registration successful",
            username: newUser.username,
            user: newUser,
            autoLogin: true
        });
    } catch (error) {
        console.error("File registration error:", error);
        res.status(500).json({ message: "Failed to process registration file" });
    }
}

// ─── LOGOUT ─────────────────────────────────────────────────────────
export function logout(req: Request, res: Response) {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out" });
    });
}

// ─── GET CURRENT USER ───────────────────────────────────────────────
export async function getCurrentUser(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        const isAdmin = (req.session as any)?.isAdmin;

        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        let user;

        if (isAdmin) {
            const adminUser = adminStorage.getAdminUserById(userId);
            if (adminUser) {
                const machineId = await ultimateGenerator.getUserMachineId(adminUser.id || userId, adminUser.username);
                user = {
                    id: adminUser.id,
                    username: adminUser.username,
                    password: adminUser.password,
                    role: adminUser.role || 'admin',
                    name: adminUser.name,
                    shopId: adminUser.shopId,
                    accountNumber: adminUser.accountNumber,
                    balance: adminUser.adminGeneratedBalance,
                    isBlocked: Boolean(adminUser.isBlocked),
                    machineId: machineId,
                    createdAt: adminUser.createdAt
                } as any;
            }
        }

        if (!user) {
            user = await storage.getUser(userId);
        }

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        // Generate machine ID dynamically for employees (if not already set)
        if (!user.machineId) {
            user.machineId = await ultimateGenerator.getUserMachineId(user.id, user.username);
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
}

// ─── VERIFY MACHINE ID ─────────────────────────────────────────────
export async function verifyMachineId(req: Request, res: Response) {
    try {
        const { machineId } = req.body;

        if (!machineId) {
            return res.status(400).json({ message: "Machine ID is required" });
        }

        // Support both base and user-specific ultimate formats
        const baseMachineId = machineId.split('-USR')[0]; // Extract base ID from user-specific ID
        
        if (!baseMachineId.startsWith('BNG-ULT-2.0-')) {
            return res.status(400).json({
                valid: false,
                message: "Invalid machine ID format. Please use the ultimate machine ID format."
            });
        }

        // Verify the base machine ID
        const isValid = await ultimateGenerator.verifyMachineId(baseMachineId);

        if (isValid) {
            res.json({
                valid: true,
                message: machineId.includes('-USR') 
                    ? "User-specific Machine ID is valid for this system"
                    : "Base Machine ID is valid for this system",
                systemInfo: {
                    platform: os.platform(),
                    arch: os.arch(),
                    hostname: os.hostname(),
                    format: machineId.includes('-USR') ? "User-Specific Ultimate" : "Base Ultimate",
                    baseMachineId: baseMachineId,
                    isUserSpecific: machineId.includes('-USR')
                }
            });
        } else {
            res.status(403).json({
                valid: false,
                message: "Machine ID is not valid for this system"
            });
        }
    } catch (error) {
        console.error('Error verifying machine ID:', error);
        res.status(500).json({ message: "Failed to verify machine ID" });
    }
}
