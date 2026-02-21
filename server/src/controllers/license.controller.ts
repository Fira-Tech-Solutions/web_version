// @ts-nocheck
import type { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { getHardwareId } from "../lib/hardware-id";
import {
    isActivated,
    setActivation,
    isTokenUsed,
    recordToken,
    getTotalRecharged,
    isRechargeUsed,
    recordUsedRecharge,
    generateFileSignature,
} from "../../../scripts/license-db";
import { storage } from "../../storage/storage";
import { decryptData, verifyBalance, signBalance, encryptData } from "../lib/crypto";
import secureConfig from "../config/secure-config";

// Use secure configuration instead of hardcoded paths
let PUBLIC_KEY: string | null = null;

try {
    PUBLIC_KEY = secureConfig.getRSAPublicKey();
    if (!PUBLIC_KEY) {
        console.warn("License Controller: Public key not found in secure config");
        // Fallback to file for development
        const PUBLIC_KEY_PATH = path.join(process.cwd(), "keys", "public_key.pem");
        if (fs.existsSync(PUBLIC_KEY_PATH)) {
            PUBLIC_KEY = fs.readFileSync(PUBLIC_KEY_PATH, "utf8");
        }
    }
} catch (e) {
    console.warn("License Controller: Failed to load public key", e);
}

// GET /api/license/status
export const getStatus = (_req: Request, res: Response) => {
    try {
        res.json({ activated: isActivated() });
    } catch (err) {
        res.status(500).json({ message: "Failed to get license status" });
    }
};

// GET /api/license/machine-id
export const getMachineId = async (_req: Request, res: Response) => {
    try {
        res.json({ machineId: await getHardwareId() });
    } catch (err) {
        res.status(500).json({ message: "Failed to get machine ID" });
    }
};

// POST /api/license/deactivate
export const deactivate = async (req: Request, res: Response) => {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { machineId } = req.body;
        if (!machineId) {
            return res.status(400).json({ message: "Machine ID required" });
        }

        // Get current machine ID for verification
        const currentMachineId = await getHardwareId();
        if (machineId !== currentMachineId) {
            return res.status(403).json({ 
                message: "Machine ID mismatch. You can only deactivate the current machine." 
            });
        }

        const { deactivateActivation } = require("../../../scripts/license-db");
        deactivateActivation(machineId);

        res.json({ 
            success: true, 
            message: "Machine deactivated successfully" 
        });
    } catch (error: any) {
        console.error("Deactivation error:", error);
        res.status(500).json({ message: "Failed to deactivate machine" });
    }
};

// POST /api/activate
export const activate = async (req: Request, res: Response) => {
    if (!PUBLIC_KEY) {
        return res.status(500).json({ message: "Server configuration error: Public key missing" });
    }

    try {
        const { encryptedData } = req.body;
        if (!encryptedData || typeof encryptedData !== "string") {
            return res.status(400).json({ message: "Activation file data required" });
        }

        const decrypted = decryptData(encryptedData);
        const { payload, signature } = decrypted;

        if (!payload || !signature) {
            return res.status(400).json({ message: "Invalid activation file format" });
        }

        if (!verifyBalance(payload, signature, PUBLIC_KEY)) {
            return res.status(401).json({ message: "Invalid signature" });
        }

        const currentMachineId = await getHardwareId();
        
        // Extract base machine ID from payload (handles both base and user-specific formats)
        const payloadBaseMachineId = payload.machineId.split('-USR')[0];
        
        if (payloadBaseMachineId !== currentMachineId) {
            return res.status(403).json({ 
                message: "MachineID mismatch",
                expected: currentMachineId,
                received: payload.machineId
            });
        }

        setActivation(payload.machineId);
        res.json({ success: true, message: "Activation successful" });
    } catch (err: any) {
        console.error("Activation error:", err);
        res.status(500).json({ message: "Activation failed" });
    }
};

// POST /api/license/generate-activation
export const generateActivation = (req: Request, res: Response) => {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const { privateKey, machineId, expiryDays = 365 } = req.body;
        
        if (!privateKey || !machineId) {
            return res.status(400).json({ 
                message: "Private key and machine ID required",
                received: { hasPrivateKey: !!privateKey, hasMachineId: !!machineId }
            });
        }

        // Create activation payload
        const payload = {
            machineId: machineId,
            timestamp: Date.now(),
            expiryDate: Date.now() + (expiryDays * 24 * 60 * 60 * 1000), // Convert days to milliseconds
            type: "activation"
        };

        // Sign the payload with the provided private key
        const signature = signBalance(payload, privateKey);
        
        const activationFile = {
            payload,
            signature
        };

        // Encrypt the activation file
        const encryptedData = encryptData(activationFile);

        // Generate filename
        const filename = `activation_${machineId.substring(0, 8)}_${Date.now()}.enc`;

        res.json({
            success: true,
            filename,
            encryptedData,
            payload: {
                machineId: payload.machineId,
                expiryDate: new Date(payload.expiryDate).toISOString(),
                type: payload.type
            }
        });
    } catch (error) {
        console.error("Activation file generation error:", error);
        res.status(500).json({ message: "Failed to generate activation file" });
    }
};

// POST /api/recharge/topup
export const topup = async (req: Request, res: Response) => {
    if (!PUBLIC_KEY) {
        return res.status(500).json({ message: "Server configuration error: Public key missing" });
    }

    try {
        const userId = (req.session as any)?.userId;
        const user = userId ? await storage.getUser(userId) : null;
        if (!user || user.role !== "employee") {
            return res.status(403).json({ message: "Employee login required" });
        }

        const { encryptedData } = req.body;
        if (!encryptedData || typeof encryptedData !== "string") {
            return res.status(400).json({ message: "Invalid file data" });
        }

        // Following original logic: topup uses JSON.parse instead of decryptData for some reason
        let decrypted;
        try {
            decrypted = JSON.parse(encryptedData);
        } catch (parseError) {
            // Fallback to decryptData if JSON.parse fails (maybe format changed)
            try {
                decrypted = decryptData(encryptedData);
            } catch (e) {
                return res.status(400).json({ message: "Invalid file format" });
            }
        }

        const { payload, signature } = decrypted;
        if (!payload || !signature) {
            console.log("Decrypted data:", decrypted);
            return res.status(400).json({ message: "Invalid balance file structure" });
        }

        const { transactionID, amount, employeeAccountNumber } = payload;
        if (employeeAccountNumber && user.accountNumber && employeeAccountNumber !== user.accountNumber) {
            return res.status(403).json({ message: "This file is for another account" });
        }

        if (isTokenUsed(transactionID) || isRechargeUsed(generateFileSignature(encryptedData))) {
            return res.status(400).json({ message: "This file has already been used" });
        }

        const amountNum = parseFloat(String(amount));
        const currentBalance = parseFloat(user.balance?.toString() || "0");
        const newBalance = (currentBalance + amountNum).toFixed(2);

        await storage.updateUserBalance(user.id, newBalance);
        recordToken(transactionID, amountNum, user.id);
        recordUsedRecharge(generateFileSignature(encryptedData), transactionID, amountNum, user.id, getHardwareId());

        res.json({
            success: true,
            message: "Recharge successful",
            amount: amountNum,
            balance: newBalance,
        });
    } catch (err: any) {
        console.error("Recharge topup error:", err);
        res.status(500).json({ message: "Recharge failed" });
    }
};

// GET /api/recharge/total
export const getTotal = async (req: Request, res: Response) => {
    try {
        const userId = (req.session as any)?.userId;
        const user = userId ? await storage.getUser(userId) : null;
        if (!user || user.role !== "employee") {
            return res.status(403).json({ message: "Employee login required" });
        }
        res.json({ totalRecharged: getTotalRecharged(user.id) });
    } catch (err) {
        res.status(500).json({ message: "Failed to get total" });
    }
};
