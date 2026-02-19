/**
 * Admin Script: Generate Activation File (.enc)
 * Run on Admin PC. Employee provides their MachineID from activation screen.
 *
 * Usage: npx tsx scripts/generate_activation_file.ts <machineId> [days]
 * Output: activation_<machineId>_<timestamp>.enc (copy to Employee PC via USB)
 */
import * as fs from "fs";
import * as path from "path";
import { encryptData, signBalance } from "../server/src/lib/crypto";

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("🎯 Go Bingo Activation File Generator");
  console.error("");
  console.error("Usage: npx tsx scripts/generate_activation_file.ts <machineId> [days]");
  console.error("Example: npx tsx scripts/generate_activation_file.ts abc123def456 365");
  console.error("Example: npx tsx scripts/generate_activation_file.ts 955d9f612dc3850e38de6fbe5b7626202");
  process.exit(1);
}

const machineId = args[0].trim();
const expiryDays = parseInt(args[1]) || 365;

if (!machineId) {
  console.error("❌ MachineID cannot be empty");
  process.exit(1);
}

if (machineId.length < 10) {
  console.error("❌ MachineID seems too short");
  process.exit(1);
}

console.log(`🔐 Generating activation file...`);
console.log(`📱 Machine ID: ${machineId}`);
console.log(`⏰ Expiry: ${expiryDays} days`);

const privateKeyPath = path.join(process.cwd(), "keys", "private_key.pem");
if (!fs.existsSync(privateKeyPath)) {
  console.error("❌ Private key not found at keys/private_key.pem");
  console.error("💡 Make sure you have the private key file in the keys/ directory");
  process.exit(1);
}

try {
  const privateKey = fs.readFileSync(privateKeyPath, "utf8");
  
  // Create activation payload with expiry
  const payload = {
    machineId: machineId,
    timestamp: Date.now(),
    expiryDate: Date.now() + (expiryDays * 24 * 60 * 60 * 1000), // Convert days to milliseconds
    type: "activation"
  };

  console.log("📝 Creating payload...");
  console.log(`📅 Valid until: ${new Date(payload.expiryDate).toLocaleDateString()}`);

  const signature = signBalance(payload, privateKey);
  const encrypted = encryptData({ payload, signature });

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(process.cwd(), `activation_${machineId.slice(0, 8)}_${timestamp}.enc`);
  
  fs.writeFileSync(outFile, encrypted);

  console.log("✅ Activation file created successfully!");
  console.log(`📁 File: ${outFile}`);
  console.log(`📊 Size: ${(fs.statSync(outFile).size / 1024).toFixed(2)} KB`);
  console.log("");
  console.log("📋 Next steps:");
  console.log("1. Copy this file to the target machine");
  console.log("2. Upload the file in the activation screen");
  console.log("3. The application will activate automatically");

} catch (error: any) {
  console.error("❌ Error generating activation file:", error.message);
  process.exit(1);
}
