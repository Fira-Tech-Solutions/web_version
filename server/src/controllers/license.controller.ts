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
import { decryptData, verifyBalance } from "../lib/crypto";

const PUBLIC_KEY_PATH = path.join(process.cwd(), "keys", "public_key.pem");
let PUBLIC_KEY: string | null = null;

try {
    if (fs.existsSync(PUBLIC_KEY_PATH)) {
        PUBLIC_KEY = fs.readFileSync(PUBLIC_KEY_PATH, "utf8");
    }
} catch (e) {
    console.warn("License Controller: Public key not found at", PUBLIC_KEY_PATH);
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
export const getMachineId = (_req: Request, res: Response) => {
    try {
        res.json({ machineId: getHardwareId() });
    } catch (err) {
        res.status(500).json({ message: "Failed to get machine ID" });
    }
};

// POST /api/activate
export const activate = (req: Request, res: Response) => {
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

        const currentMachineId = getHardwareId();
        if (payload.machineId !== currentMachineId) {
            return res.status(403).json({ message: "MachineID mismatch" });
        }

        setActivation(payload.machineId);
        res.json({ success: true, message: "Activation successful" });
    } catch (err: any) {
        console.error("Activation error:", err);
        res.status(500).json({ message: "Activation failed" });
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
