/**
 * License File Generator
 * Creates encrypted .enc license files bound to specific hardware
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { getHardwareIdSync } from '../server/lib/hardware-id';

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

// Configuration
const PRIVATE_KEY_PATH = path.join(process.cwd(), 'keys', 'private_key.pem');

function getPrivateKey(): string {
  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error("❌ Private key not found at:", PRIVATE_KEY_PATH);
    console.log("💡 Run 'npm run generate-keys' first to create RSA key pair");
    process.exit(1);
  }
  return fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
}

function signLicense(payload: LicensePayload, privateKey: string): string {
  // Sort keys for consistent signature
  const sortedPayload = JSON.stringify(payload, Object.keys(payload).sort());
  const signature = crypto.sign("sha256", Buffer.from(sortedPayload), privateKey);
  return signature.toString('base64');
}

function generateLicenseFile(
  deviceId: string,
  licenseType: 'trial' | 'full' | 'enterprise',
  options: {
    expiresIn?: number; // days
    features?: string[];
  } = {}
): LicenseFile {
  const payload: LicensePayload = {
    deviceId,
    licenseType,
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex'),
    features: options.features || []
  };

  // Add expiration if specified
  if (options.expiresIn) {
    payload.expiresAt = Date.now() + (options.expiresIn * 24 * 60 * 60 * 1000);
  }

  const privateKey = getPrivateKey();
  const signature = signLicense(payload, privateKey);

  return { payload, signature };
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🔐 BingoMaster License Generator

Usage:
  ts-node scripts/generate_license.ts <deviceId> <licenseType> [options]

Examples:
  # Generate 30-day trial license
  ts-node scripts/generate_license.ts abc123def456 trial 30

  # Generate full license (no expiration)
  ts-node scripts/generate_license.ts abc123def456 full

  # Generate enterprise license with features
  ts-node scripts/generate_license.ts abc123def456 enterprise 365 "multi-user,advanced-analytics"

License Types:
  - trial: Temporary license with expiration
  - full: Full-featured license (no expiration)
  - enterprise: Enterprise license with additional features

Options:
  - expiresIn: Number of days until expiration (for trial licenses)
  - features: Comma-separated list of features (for enterprise licenses)

Get Device ID:
  - Start the application and copy the Machine ID from Activation Page
  - Or use: ts-node -e "console.log(require('./server/lib/hardware-id.ts').getHardwareIdSync())"
    `);
    process.exit(0);
  }

  const deviceId = args[0];
  const licenseType = args[1] as 'trial' | 'full' | 'enterprise';
  
  if (!['trial', 'full', 'enterprise'].includes(licenseType)) {
    console.error("❌ Invalid license type. Must be: trial, full, or enterprise");
    process.exit(1);
  }

  const options: any = {};
  
  // Parse expiration (for trial licenses)
  if (licenseType === 'trial' && args[2]) {
    const days = parseInt(args[2]);
    if (isNaN(days) || days <= 0) {
      console.error("❌ Invalid expiration days. Must be a positive number");
      process.exit(1);
    }
    options.expiresIn = days;
  } else if (licenseType === 'trial') {
    options.expiresIn = 30; // Default 30 days for trial
  }

  // Parse features (for enterprise licenses)
  if (licenseType === 'enterprise' && args[2]) {
    options.features = args[2].split(',').map(f => f.trim());
  }

  try {
    console.log(`🔐 Generating ${licenseType} license for device: ${deviceId}`);
    
    const licenseFile = generateLicenseFile(deviceId, licenseType, options);
    
    // Create output filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `license_${licenseType}_${deviceId.slice(0, 8)}_${timestamp}.enc`;
    
    // Write license file
    fs.writeFileSync(filename, JSON.stringify(licenseFile, null, 2));
    
    console.log(`✅ License file created: ${filename}`);
    console.log(`📋 License Details:`);
    console.log(`   - Device ID: ${licenseFile.payload.deviceId}`);
    console.log(`   - License Type: ${licenseFile.payload.licenseType}`);
    console.log(`   - Issued At: ${new Date(licenseFile.payload.issuedAt).toLocaleString()}`);
    
    if (licenseFile.payload.expiresAt) {
      console.log(`   - Expires At: ${new Date(licenseFile.payload.expiresAt).toLocaleString()}`);
      const daysLeft = Math.ceil((licenseFile.payload.expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
      console.log(`   - Valid For: ${daysLeft} days`);
    }
    
    if (licenseFile.payload.features && licenseFile.payload.features.length > 0) {
      console.log(`   - Features: ${licenseFile.payload.features.join(', ')}`);
    }
    
    console.log(`📤 Send this file to the user for activation`);
    
  } catch (error) {
    console.error("❌ Failed to generate license:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateLicenseFile };
export type { LicensePayload, LicenseFile };
