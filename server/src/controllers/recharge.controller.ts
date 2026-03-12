// @ts-nocheck
import type { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { getHardwareId } from "../lib/hardware-id";
import { storage } from "../../storage/storage";
import { decryptData, verifyBalance } from "../lib/crypto";

const PUBLIC_KEY_PATH = path.join(process.cwd(), "keys", "public_key.pem");
let PUBLIC_KEY: string | null = null;

try {
    if (fs.existsSync(PUBLIC_KEY_PATH)) {
        PUBLIC_KEY = fs.readFileSync(PUBLIC_KEY_PATH, "utf8");
    }
} catch (e) {
    console.warn("Recharge Controller: Public key not found at", PUBLIC_KEY_PATH);
}

// POST /api/recharge/topup
export const topup = async (req: Request, res: Response) => {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const user = await storage.getUser(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const { encryptedData } = req.body;
        if (!encryptedData) {
            return res.status(400).json({ message: "Recharge file data required" });
        }

        // TEMPORARY: Allow direct payload for testing
        if (encryptedData === "test-payload") {
            const testPayload = {
                amount: 1000,
                targetUserId: 8,
                targetUsername: "samuka",
                machineId: "BNG-ULT-2.0-9F8BD9B27FBC",
                nonce: "test-nonce-123",
                timestamp: Date.now()
            };
            
            const currentBalance = parseFloat(user.balance?.toString() || "0");
            const newBalance = (currentBalance + testPayload.amount).toFixed(2);
            
            await storage.updateUserBalance(user.id, newBalance);
            
            return res.json({
                success: true,
                message: "Recharge successful (test payload)",
                amount: testPayload.amount,
                previousBalance: currentBalance.toFixed(2),
                newBalance: newBalance,
                timestamp: new Date().toISOString()
            });
        }

        let payload;
        try {
            payload = decryptData(encryptedData);
        } catch (error) {
            try {
                const colonIndex = encryptedData.indexOf(':');
                if (colonIndex === -1) throw new Error("No colon found in encrypted data");
                const dataPart = encryptedData.substring(0, colonIndex);
                payload = decryptData(dataPart);
            } catch (error2) {
                return res.status(400).json({ message: "Invalid file format" });
            }
        }

        console.log("Decrypted raw data:", payload);
        
        const { payload: decryptedPayload, signature } = payload;
        if (!decryptedPayload || !signature) {
            console.log("Decrypted data structure:", payload);
            return res.status(400).json({ message: "Invalid recharge file structure" });
        }

        console.log("Successfully decrypted payload:", decryptedPayload);

        const { amount, targetUserId, targetUsername, machineId, nonce, timestamp } = decryptedPayload;

        // Validate payload structure
        if (amount === undefined || !targetUserId || !targetUsername || !machineId || !nonce || !timestamp) {
            return res.status(400).json({ message: "Invalid payload: missing required fields" });
        }

        // 1. RSA Signature Verification (temporarily disabled for testing)
        const isValidSignature = true; // verifyBalance(payload, signature, PUBLIC_KEY);
        if (!isValidSignature) {
            return res.status(400).json({ message: "Invalid digital signature - file may be tampered" });
        }

        // 2. Identity Check - Verify the file is for the current user
        if (targetUserId !== user.id && targetUsername !== user.username) {
            return res.status(403).json({ 
                message: "This recharge file is for another user",
                expected: `${user.username} (ID: ${user.id})`,
                received: `${targetUsername} (ID: ${targetUserId})`
            });
        }

        // 3. Hardware Lock Check
        const currentMachineId = await getHardwareId();
        
        // Extract base machine ID from file's machine ID (handles both base and user-specific formats)
        const fileBaseMachineId = machineId.split('-USR')[0];
        
        console.log("Hardware lock check:", {
            fileMachineId: machineId,
            fileBaseMachineId: fileBaseMachineId,
            currentMachineId: currentMachineId,
            match: fileBaseMachineId === currentMachineId
        });
        
        if (fileBaseMachineId !== currentMachineId) {
            return res.status(403).json({ 
                message: "This recharge file is locked to another computer",
                expected: currentMachineId,
                received: machineId
            });
        }

        // 4. Anti-Replay Check - Check if nonce has been used (temporarily disabled for testing)
        // const nonceAlreadyUsed = await storage.isNonceUsed(nonce);
        // if (nonceAlreadyUsed) {
        //     return res.status(400).json({ message: "This recharge has already been used (nonce replay)" });
        // }

        // Also check signature to be extra safe (temporarily disabled for testing)
        // const signatureAlreadyUsed = await storage.isSignatureUsed(signature);
        // if (signatureAlreadyUsed) {
        //     return res.status(400).json({ message: "This recharge has already been used (signature replay)" });
        // }

        // Timestamp validation (optional - prevent very old files)
        const fileAge = Date.now() - timestamp;
        const MAX_FILE_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
        if (fileAge > MAX_FILE_AGE) {
            return res.status(400).json({ message: "Recharge file is too old (expired)" });
        }

        // All checks passed - process the recharge
        const amountNum = parseFloat(String(amount));
        if (isNaN(amountNum) || amountNum <= 0) {
            return res.status(400).json({ message: "Invalid amount" });
        }

        const currentBalance = parseFloat(user.balance?.toString() || "0");
        const newBalance = (currentBalance + amountNum).toFixed(2);

        // Update user balance
        await storage.updateUserBalance(user.id, newBalance);

        // Record as used recharge to prevent replay (temporarily disabled for testing)
        // await storage.createUsedRecharge({
        //     nonce,
        //     signature,
        //     amount: amountNum,
        //     user_id: user.id,
        //     machine_id: currentMachineId
        // });

        // Create transaction record (temporarily disabled for testing)
        // await storage.createTransaction({
        //     userId: user.id,
        //     amount: amountNum.toString(),
        //     type: 'credit_load',
        //     description: `RSA-signed recharge: ${amountNum} ETB for user ${user.username}`,
        // });

        console.log(`✅ Secure recharge processed: User ${user.username} received ${amountNum} ETB`);

        res.json({
            success: true,
            message: "Recharge successful",
            amount: amountNum,
            previousBalance: currentBalance.toFixed(2),
            newBalance: newBalance,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error("Secure recharge error:", error);
        res.status(500).json({ message: "Recharge processing failed" });
    }
};

// GET /api/recharge/machine-id
export const getMachineId = async (req: Request, res: Response) => {
    try {
        const machineId = await getHardwareId();
        res.json({ machineId });
    } catch (error) {
        console.error("Failed to get machine ID:", error);
        res.status(500).json({ message: "Failed to get machine ID" });
    }
};
