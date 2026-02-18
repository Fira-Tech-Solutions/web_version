// @ts-nocheck
/**
 * License Verification Engine
 * Handles RSA decryption, hardware matching, and license persistence
 */
import * as crypto from "crypto";
import { storage } from "../../storage/storage";
import { getHardwareId } from "./hardware-id";

export interface LicensePayload {
  deviceId: string;
  licenseType: 'trial' | 'full' | 'enterprise';
  expiresAt?: number; // Unix timestamp
  features?: string[];
  issuedAt: number;
  nonce: string;
}

export interface LicenseFile {
  payload: LicensePayload;
  signature: string;
}

export interface VerificationResult {
  isValid: boolean;
  error?: string;
  payload?: LicensePayload;
}

/**
 * Verifies a license file against the current hardware or provided client ID
 */
export async function verifyLicense(licenseData: string, clientMachineId?: string): Promise<VerificationResult> {
  try {
    // Parse the license file
    const licenseFile: LicenseFile = JSON.parse(licenseData);

    // Validate structure
    if (!licenseFile.payload || !licenseFile.signature) {
      return { isValid: false, error: "Invalid license file structure" };
    }

    const payload = licenseFile.payload;

    // Verify required fields
    if (!payload.deviceId || !payload.licenseType || !payload.issuedAt || !payload.nonce) {
      return { isValid: false, error: "Missing required license fields" };
    }

    // Determine which machine ID to use for verification
    let targetMachineId: string;

    if (clientMachineId) {
      // Use client-provided machine ID (for browser/development environments)
      targetMachineId = clientMachineId;
    } else {
      // Use server-side hardware ID (for production/Electron environments)
      targetMachineId = getHardwareId();
    }

    // Verify hardware match
    if (payload.deviceId !== targetMachineId) {
      return {
        isValid: false,
        error: "Invalid License: This file belongs to a different device."
      };
    }

    // Verify signature using public key
    const publicKey = await getPublicKey();
    if (!publicKey) {
      return { isValid: false, error: "Server configuration error: Public key missing" };
    }

    const dataToVerify = JSON.stringify(payload, Object.keys(payload).sort());
    const isValidSignature = crypto.verify(
      "sha256",
      Buffer.from(dataToVerify),
      publicKey,
      Buffer.from(licenseFile.signature, "base64")
    );

    if (!isValidSignature) {
      return { isValid: false, error: "Invalid signature: License file may be corrupted or tampered" };
    }

    // Check expiration if present
    if (payload.expiresAt) {
      const now = Date.now();
      if (now > payload.expiresAt) {
        return { isValid: false, error: "License has expired" };
      }
    }

    return { isValid: true, payload };

  } catch (error) {
    console.error("License verification error:", error);
    return { isValid: false, error: "Failed to verify license file" };
  }
}

/**
 * Saves a verified license to the system settings
 */
export async function saveLicense(licenseData: string): Promise<boolean> {
  try {
    await storage.setSystemSetting("license", licenseData);
    await storage.setSystemSetting("license_verified_at", Date.now().toString());
    return true;
  } catch (error) {
    console.error("Failed to save license:", error);
    return false;
  }
}

/**
 * Retrieves and verifies the saved license
 */
export async function getSavedLicense(): Promise<VerificationResult> {
  try {
    const licenseSetting = await storage.getSystemSetting("license");
    if (!licenseSetting) {
      return { isValid: false, error: "No license found" };
    }

    return await verifyLicense(licenseSetting.value);
  } catch (error) {
    console.error("Failed to get saved license:", error);
    return { isValid: false, error: "Failed to retrieve license" };
  }
}

/**
 * Checks if the system has a valid license
 */
export async function hasValidLicense(): Promise<boolean> {
  const result = await getSavedLicense();
  return result.isValid;
}

/**
 * Removes the saved license (for testing or license transfer)
 */
export async function removeLicense(): Promise<boolean> {
  try {
    await storage.deleteSystemSetting("license");
    await storage.deleteSystemSetting("license_verified_at");
    return true;
  } catch (error) {
    console.error("Failed to remove license:", error);
    return false;
  }
}

/**
 * Gets the public key from file system
 */
async function getPublicKey(): Promise<string | null> {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const publicKeyPath = path.join(process.cwd(), "keys", "public_key.pem");

    if (fs.existsSync(publicKeyPath)) {
      return fs.readFileSync(publicKeyPath, "utf8");
    } else {
      console.warn("Public key not found at:", publicKeyPath);
      return null;
    }
  } catch (error) {
    console.error("Error reading public key:", error);
    return null;
  }
}

/**
 * Gets license information for display
 */
export async function getLicenseInfo(): Promise<{
  isValid: boolean;
  licenseType?: string;
  expiresAt?: number;
  deviceId?: string;
  error?: string;
}> {
  const result = await getSavedLicense();

  if (!result.isValid || !result.payload) {
    return { isValid: false, error: result.error };
  }

  return {
    isValid: true,
    licenseType: result.payload.licenseType,
    expiresAt: result.payload.expiresAt,
    deviceId: result.payload.deviceId
  };
}
