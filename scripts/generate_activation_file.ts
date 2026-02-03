/**
 * Admin Script: Generate Activation File (.enc)
 * Run on Admin PC. Employee provides their MachineID from First-Time Registration screen.
 *
 * Usage: npx tsx scripts/generate_activation_file.ts <machineId>
 * Output: activation_<machineId>.enc (copy to Employee PC via USB)
 */
import * as fs from "fs";
import * as path from "path";
import { encryptData, signBalance } from "../server/lib/crypto";

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: npx tsx scripts/generate_activation_file.ts <machineId>");
  console.error("Example: npx tsx scripts/generate_activation_file.ts abc123def456...");
  process.exit(1);
}

const machineId = args[0].trim();
if (!machineId) {
  console.error("MachineID cannot be empty");
  process.exit(1);
}

const privateKeyPath = path.join(process.cwd(), "keys", "private_key.pem");
if (!fs.existsSync(privateKeyPath)) {
  console.error("Private key not found at keys/private_key.pem. Run generate_keys.ts first.");
  process.exit(1);
}

const privateKey = fs.readFileSync(privateKeyPath, "utf8");
const payload = { machineId };
const signature = signBalance(payload, privateKey);
const encrypted = encryptData({ payload, signature });

const outFile = path.join(process.cwd(), `activation_${machineId.slice(0, 12)}.enc`);
fs.writeFileSync(outFile, encrypted);

console.log(`Activation file created: ${outFile}`);
console.log(`MachineID: ${machineId}`);
console.log("Copy this file to the Employee PC and upload it in the First-Time Registration screen.");
