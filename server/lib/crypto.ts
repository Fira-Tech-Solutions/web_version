import crypto from "crypto";

// For this implementation, we will use a fixed key directory or environment variables.
// In a real production app, these should be securely stored.
const SECRET_KEY = process.env.ENCRYPTION_SECRET || "bingo-master-secure-shared-secret-key-32";

/**
 * Basic AES encryption for account data (Symmetric)
 */
export function encryptData(data: object): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(SECRET_KEY.padEnd(32).slice(0, 32)), iv);
    let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
}

export function decryptData(encryptedString: string): any {
    const [ivHex, encryptedHex] = encryptedString.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(SECRET_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted);
}

/**
 * RSA-based signing for Balance Recharge (Public/Private Key)
 * The server acts as the verifier of the Admin's signed files.
 */

// Simple mock for generating keys if needed, but we'll use a single system key for now
// to simplify the "Public Key" requirement as a "Verified Signature".
export function signBalance(payload: object, privateKey: string): string {
    const signer = crypto.createSign("sha256");
    signer.update(JSON.stringify(payload));
    signer.end();
    return signer.sign(privateKey, "hex");
}

export function verifyBalance(payload: object, signature: string, publicKey: string): boolean {
    const verifier = crypto.createVerify("sha256");
    verifier.update(JSON.stringify(payload));
    verifier.end();
    return verifier.verify(publicKey, signature, "hex");
}

// Helper to generate a key pair for the system
export function generateKeyPair() {
    return crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "pkcs1", format: "pem" },
        privateKeyEncoding: { type: "pkcs1", format: "pem" },
    });
}
