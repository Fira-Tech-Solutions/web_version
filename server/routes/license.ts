/**
 * Air-Gapped Licensing & Recharge Routes
 */
import { Router, type Request, type Response } from "express";
import * as crypto from "crypto";
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
} from "../db/license-db";
import { decryptData, verifyBalance } from "../lib/crypto";
import { storage } from "../storage";

const router = Router();
const PUBLIC_KEY_PATH = path.join(process.cwd(), "keys", "public_key.pem");
let PUBLIC_KEY: string | null = null;

try {
  if (fs.existsSync(PUBLIC_KEY_PATH)) {
    PUBLIC_KEY = fs.readFileSync(PUBLIC_KEY_PATH, "utf8");
  }
} catch (e) {
  console.warn("License: Public key not found at", PUBLIC_KEY_PATH);
}

/**
 * GET /api/license/status
 * Returns activation state. Used by frontend to show First-Time Registration vs Login.
 */
router.get("/status", (_req: Request, res: Response) => {
  try {
    const activated = isActivated();
    res.json({ activated });
  } catch (err) {
    console.error("License status error:", err);
    res.status(500).json({ message: "Failed to get license status" });
  }
});

/**
 * GET /api/license/machine-id
 * Returns current machine's Hardware ID for First-Time Registration.
 * Employee shares this with Admin to receive activation file.
 */
router.get("/machine-id", (_req: Request, res: Response) => {
  try {
    const machineId = getHardwareId();
    res.json({ machineId });
  } catch (err) {
    console.error("Machine ID error:", err);
    res.status(500).json({ message: "Failed to get machine ID" });
  }
});

/**
 * POST /api/activate handler (exported for mounting at /api/activate)
 * Accepts .enc file content. Verifies MachineID matches current PC using RSA.
 * On success, stores activation in SQLite.
 *
 * Expected file format (decrypted): { payload: { machineId }, signature }
 * Admin signs payload with private key; we verify with public key.
 */
export const activateHandler = (req: Request, res: Response) => {
  if (!PUBLIC_KEY) {
    return res.status(500).json({ message: "Server configuration error: Public key missing" });
  }

  try {
    const { encryptedData } = req.body;
    if (!encryptedData || typeof encryptedData !== "string") {
      return res.status(400).json({ message: "Activation file data (.enc content) required" });
    }

    const decrypted = decryptData(encryptedData);
    const { payload, signature } = decrypted;

    if (!payload || !signature) {
      return res.status(400).json({ message: "Invalid activation file format" });
    }

    const { machineId } = payload;
    if (!machineId) {
      return res.status(400).json({ message: "Activation file missing MachineID" });
    }

    // Verify RSA signature
    const isValid = verifyBalance(payload, signature, PUBLIC_KEY);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid signature. Activation file may be tampered." });
    }

    // Verify MachineID matches current PC
    const currentMachineId = getHardwareId();
    if (machineId !== currentMachineId) {
      return res.status(403).json({
        message: "MachineID mismatch. This activation file is for a different computer.",
      });
    }

    setActivation(machineId);
    res.json({ success: true, message: "Activation successful. You can now use the application." });
  } catch (err: any) {
    console.error("Activation error:", err);
    res.status(500).json({
      message: err.message?.includes("decrypt") ? "Invalid or corrupted activation file" : "Activation failed",
    });
  }
};

/**
 * POST /api/recharge/topup
 * One-time recharge via .enc file.
 * Verifies transactionID is unique in used_tokens, adds amount to balance, records transactionID.
 *
 * Expected file format (decrypted): { payload: { transactionID, amount, employeeAccountNumber? }, signature }
 */
const topupHandler = async (req: Request, res: Response) => {
  console.log('Top-up request received:', {
    method: req.method,
    headers: req.headers,
    body: req.body,
    contentType: req.get('content-type')
  });

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
      return res.status(400).json({ 
        message: "Invalid file data. Please upload a valid .enc file.",
        error: "INVALID_FILE_DATA"
      });
    }

    // Try to parse the JSON data
    let decrypted;
    try {
      decrypted = JSON.parse(encryptedData);
    } catch (parseError) {
      return res.status(400).json({ 
        message: "Invalid file format. The file appears to be corrupted or not a valid balance file.",
        error: "INVALID_JSON_FORMAT"
      });
    }

    const { payload, signature } = decrypted;

    if (!payload || !signature) {
      return res.status(400).json({ 
        message: "Invalid balance file structure. Missing required payload or signature data.",
        error: "MISSING_REQUIRED_FIELDS"
      });
    }

    const { transactionID, amount, employeeAccountNumber } = payload;
    if (!transactionID || amount == null) {
      return res.status(400).json({ 
        message: "Invalid balance file data. Missing transaction ID or amount information.",
        error: "MISSING_TRANSACTION_DATA"
      });
    }

    // Validate amount is a positive number
    const amountNum = parseFloat(String(amount));
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ 
        message: "Invalid amount. The amount must be a positive number.",
        error: "INVALID_AMOUNT"
      });
    }

    // Validate transactionID format
    if (typeof transactionID !== 'string' || transactionID.trim().length === 0) {
      return res.status(400).json({ 
        message: "Invalid transaction ID. The transaction ID must be a non-empty string.",
        error: "INVALID_TRANSACTION_ID"
      });
    }

    // Optional: Validate employeeAccountNumber if present
    if (employeeAccountNumber && (typeof employeeAccountNumber !== 'string' || employeeAccountNumber.trim().length === 0)) {
      return res.status(400).json({ 
        message: "Invalid employee account number format.",
        error: "INVALID_ACCOUNT_NUMBER"
      });
    }

    // Optional: verify file is for this employee
    if (employeeAccountNumber && user.accountNumber && employeeAccountNumber !== user.accountNumber) {
      return res.status(403).json({ 
        message: "This recharge file is for another account",
        error: "WRONG_ACCOUNT"
      });
    }

    // Check transactionID is unique
    if (isTokenUsed(transactionID)) {
      return res.status(400).json({ message: "This recharge file has already been used" });
    }

    // Enhanced one-time recharge enforcement using file signature
    const fileSignature = generateFileSignature(encryptedData);
    if (isRechargeUsed(fileSignature)) {
      return res.status(400).json({ message: "This recharge file has already been used on this or any other device" });
    }

    // Get current machine ID for tracking
    const currentMachineId = getHardwareId();

    // Add to balance and record
    const currentBalance = parseFloat(user.balance?.toString() || "0");
    const newBalance = (currentBalance + amountNum).toFixed(2);
    await storage.updateUserBalance(user.id, newBalance);
    recordToken(transactionID, amountNum, user.id);
    
    // Record file usage to prevent reuse
    recordUsedRecharge(fileSignature, transactionID, amountNum, user.id, currentMachineId);

    res.json({
      success: true,
      message: "Recharge successful",
      amount: amountNum,
      balance: newBalance,
    });
  } catch (err: any) {
    console.error("Recharge topup error:", err);
    res.status(500).json({
      message: err.message?.includes("decrypt") ? "Invalid or corrupted recharge file" : "Recharge failed",
    });
  }
};

// Recharge sub-router (mounted at /api/recharge)
const rechargeRouter = Router();
rechargeRouter.post("/topup", topupHandler);
rechargeRouter.get("/total", async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    const user = userId ? await storage.getUser(userId) : null;
    if (!user || user.role !== "employee") {
      return res.status(403).json({ message: "Employee login required" });
    }
    const total = getTotalRecharged(user.id);
    res.json({ totalRecharged: total });
  } catch (err) {
    console.error("Total recharged error:", err);
    res.status(500).json({ message: "Failed to get total recharged" });
  }
});

export const licenseRouter = router;
export { rechargeRouter };
