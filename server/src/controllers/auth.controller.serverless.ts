// @ts-nocheck
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import * as os from "os";
import { storage } from "../../storage/storage.js";
import { encryptData, decryptData, signBalance, verifyBalance, generateKeyPair } from "../lib/crypto.js";

// Simple machine ID generator for serverless
function getSimpleMachineId(): string {
  const hostname = os.hostname() || 'serverless';
  const platform = os.platform() || 'unknown';
  const arch = os.arch() || 'unknown';
  const timestamp = Date.now().toString();
  return Buffer.from(`${hostname}-${platform}-${arch}-${timestamp}`).toString('base64');
}

const { privateKey: SYSTEM_PRIVATE_KEY, publicKey: SYSTEM_PUBLIC_KEY } = generateKeyPair();

// ─── LOGIN ──────────────────────────────────────────────────────────
export async function login(req: Request, res: Response) {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required" });
        }

        console.log(`Login attempt: ${username}`);

        // Try to find user in PostgreSQL first
        const user = await storage.getUserByUsername(username);
        
        if (!user) {
            console.log(`User not found: ${username}`);
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

        console.log(`Password verification: ${isValidPassword}`);

        if (!isValidPassword) {
            console.log(`Password mismatch: provided=${password}, stored=${user.password}, isHashed=${isHashedPassword}`);
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Set session data
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name,
            balance: user.balance,
            isBlocked: user.isBlocked
        };

        console.log(`Login successful for: ${username}`);

        res.status(200).json({
            message: "Login successful",
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
                balance: user.balance,
                isBlocked: user.isBlocked
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

// ─── LOGOUT ─────────────────────────────────────────────────────────
export async function logout(req: Request, res: Response) {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error("Session destroy error:", err);
                return res.status(500).json({ message: "Logout failed" });
            }
            res.status(200).json({ message: "Logout successful" });
        });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

// ─── GET CURRENT USER ───────────────────────────────────────────────
export async function getCurrentUser(req: Request, res: Response) {
    try {
        if (!req.session.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await storage.getUserById(req.session.user.id);
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        res.status(200).json({
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
                balance: user.balance,
                isBlocked: user.isBlocked
            }
        });
    } catch (error) {
        console.error("Get current user error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

// ─── REGISTER FILE ───────────────────────────────────────────────────
export async function registerFile(req: Request, res: Response) {
    try {
        const { fileData } = req.body;
        
        if (!fileData) {
            return res.status(400).json({ message: "File data is required" });
        }

        // Process file registration logic here
        res.status(200).json({ message: "File registered successfully" });
    } catch (error) {
        console.error("Register file error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

// ─── VERIFY MACHINE ID ───────────────────────────────────────────────
export async function verifyMachineId(req: Request, res: Response) {
    try {
        const { machineId } = req.body;
        
        if (!machineId) {
            return res.status(400).json({ message: "Machine ID is required" });
        }

        // Simple verification for serverless
        const currentMachineId = getSimpleMachineId();
        const isValid = machineId === currentMachineId;

        res.status(200).json({
            valid: isValid,
            currentMachineId,
            message: isValid ? "Machine ID verified" : "Machine ID mismatch"
        });
    } catch (error) {
        console.error("Verify machine ID error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}
