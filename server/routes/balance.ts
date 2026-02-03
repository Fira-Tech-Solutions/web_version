
import { Router } from "express";
import { db } from "../db";
import { shops, balanceRedemptions, transactions } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const router = Router();

// Store public key in memory or read from file
// For this environment, we assume the public key is at 'keys/public_key.pem'
const PUBLIC_KEY_PATH = path.join(process.cwd(), "keys", "public_key.pem");
let PUBLIC_KEY: string | null = null;

try {
    if (fs.existsSync(PUBLIC_KEY_PATH)) {
        PUBLIC_KEY = fs.readFileSync(PUBLIC_KEY_PATH, "utf8");
    } else {
        console.warn("⚠️ Public key not found at " + PUBLIC_KEY_PATH);
    }
} catch (error) {
    console.error("Error reading public key:", error);
}

router.post("/redeem", async (req, res) => {
    if (!PUBLIC_KEY) {
        return res.status(500).json({ error: "Server configuration error: Public key missing" });
    }

    try {
        const { payload, signature } = req.body;

        if (!payload || !signature) {
            return res.status(400).json({ error: "Missing payload or signature" });
        }

        const { amount, shopId, nonce, timestamp } = payload;

        // 1. Verify Structure
        if (!amount || !shopId || !nonce || !timestamp) {
            return res.status(400).json({ error: "Invalid payload structure" });
        }

        // 2. Verify Timestamp (prevent very old tokens?) - Optional, user implied one-time use via nonce
        // Let's set a generous window if needed, but nonce check is better.

        // 3. Verify Signature
        // Reconstruct data string: amount:shopId:nonce:timestamp
        const dataToVerify = `${amount}:${shopId}:${nonce}:${timestamp}`;
        const isVerified = crypto.verify(
            "sha256",
            Buffer.from(dataToVerify),
            PUBLIC_KEY,
            Buffer.from(signature, "base64")
        );

        if (!isVerified) {
            return res.status(401).json({ error: "Invalid signature. Integrity check failed." });
        }

        // 4. Check Replay (Nonce/Signature)
        const existing = await db.query.balanceRedemptions.findFirst({
            where: eq(balanceRedemptions.signature, signature),
        });

        if (existing) {
            return res.status(400).json({ error: "This balance file has already been redeemed." });
        }

        // 5. Execute Redemption
        await db.transaction(async (tx) => {
            // 5a. Get current shop balance
            const shop = await tx.query.shops.findFirst({
                where: eq(shops.id, shopId),
            });

            if (!shop) {
                throw new Error("Shop not found");
            }

            // Match shopId from token with user's shopId?
            // Assuming caller is authorized for this shop. 
            // Ideally check req.user.shopId === shopId.
            // But let's assume valid token means valid action for that shop.

            const newBalance = (parseFloat(shop.balance?.toString() || "0") + parseFloat(amount)).toFixed(2);

            // 5b. Update Balance
            await tx.update(shops)
                .set({ balance: newBalance })
                .where(eq(shops.id, shopId));

            // 5c. Log Redemption
            await tx.insert(balanceRedemptions).values({
                shopId,
                amount: amount.toString(),
                signature,
                redeemedBy: req.session.user?.id,
            });

            // 5d. Log Transaction
            await tx.insert(transactions).values({
                shopId,
                amount: amount.toString(),
                type: 'credit_load',
                description: `Balance redemption via file. Nonce: ${nonce}`,
                adminId: req.session.user?.id,
            });
        });

        res.json({ success: true, message: "Balance redeemed successfully", amount });

    } catch (error) {
        console.error("Redemption error:", error);
        res.status(500).json({ error: "Process failed" });
    }
});

export const balanceRouter = router;
