// @ts-nocheck
import type { Request, Response } from "express";
import { db } from "../../storage/storage";
import { users, transactions } from "@shared/schema-simple";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { decryptData } from "../lib/crypto";

const PUBLIC_KEY_PATH = path.join(process.cwd(), "keys", "public_key.pem");
let PUBLIC_KEY: string | null = null;

try {
    if (fs.existsSync(PUBLIC_KEY_PATH)) {
        PUBLIC_KEY = fs.readFileSync(PUBLIC_KEY_PATH, "utf8");
    }
} catch (error) {
    console.error("Balance Controller: Error reading public key:", error);
}

// POST /api/balance/redeem
export const redeem = async (req: Request, res: Response) => {
    if (!PUBLIC_KEY) {
        return res.status(500).json({ error: "Server configuration error: Public key missing" });
    }

    try {
        const { encryptedData } = req.body;
        if (!encryptedData) {
            return res.status(400).json({ error: "Missing encrypted data" });
        }

        const payload = decryptData(encryptedData);
        const { amount, employeeId, nonce, timestamp, signature } = payload;

        if (!amount || !employeeId || !nonce || !timestamp || !signature) {
            return res.status(400).json({ error: "Invalid payload structure" });
        }

        // Verify Signature
        const dataToVerify = `${amount}:${employeeId}:${nonce}:${timestamp}`;
        const isVerified = crypto.verify(
            "sha256",
            Buffer.from(dataToVerify),
            PUBLIC_KEY,
            Buffer.from(signature, "base64")
        );

        if (!isVerified) {
            return res.status(401).json({ error: "Invalid signature" });
        }

        // Execute Redemption in transaction
        await db.transaction(async (tx) => {
            const employee = await tx.query.users.findFirst({
                where: eq(users.id, employeeId),
            });

            if (!employee) {
                throw new Error("Employee not found");
            }

            const currentBalance = parseFloat(employee.balance?.toString() || "0");
            const newBalance = (currentBalance + parseFloat(amount)).toFixed(2);

            await tx.update(users)
                .set({ balance: newBalance })
                .where(eq(users.id, employeeId));

            await tx.insert(transactions).values({
                gameId: null,
                employeeId: employeeId,
                amount: parseFloat(amount),
                type: 'credit_load',
                description: `Balance redemption via file. Nonce: ${nonce}`,
                createdAt: new Date()
            });
        });

        res.json({ success: true, message: "Balance redeemed successfully", amount });
    } catch (error) {
        console.error("Redemption error:", error);
        res.status(500).json({ error: "Process failed" });
    }
};
