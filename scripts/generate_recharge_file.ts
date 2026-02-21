/**
 * Admin Script: Generate Recharge (Top-Up) File (.enc)
 * Run on Admin PC. Creates a one-time recharge file for an employee.
 *
 * Usage: npx tsx scripts/generate_recharge_file.ts <amount> [employeeAccountNumber]
 * Output: recharge_<transactionId>.enc (copy to Employee PC via USB)
 *
 * Example: npx tsx scripts/generate_recharge_file.ts 100 BGO123456
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { encryptData, signBalance } from "../server/src/lib/crypto";

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: npx tsx scripts/generate_recharge_file.ts <amount> [employeeAccountNumber]");
  console.error("Example: npx tsx scripts/generate_recharge_file.ts 100 BGO123456");
  process.exit(1);
}

const amount = parseFloat(args[0]);
const employeeAccountNumber = args[1]?.trim() || undefined;

if (isNaN(amount) || amount <= 0) {
  console.error("Amount must be a positive number");
  process.exit(1);
}

const transactionID = crypto.randomUUID();
const payload: Record<string, unknown> = {
  transactionID,
  amount,
};
if (employeeAccountNumber) payload.employeeAccountNumber = employeeAccountNumber;

const privateKeyPath = path.join(process.cwd(), "keys", "private_key.pem");
if (!fs.existsSync(privateKeyPath)) {
  console.error("Private key not found at keys/private_key.pem. Run generate_keys.ts first.");
  process.exit(1);
}

const privateKey = fs.readFileSync(privateKeyPath, "utf8");
const signature = signBalance(payload, privateKey);
const encrypted = encryptData({ payload, signature });

const outFile = path.join(process.cwd(), `recharge_${transactionID.slice(0, 8)}.enc`);
fs.writeFileSync(outFile, encrypted);

console.log(`Recharge file created: ${outFile}`);
console.log(`TransactionID: ${transactionID}`);
console.log(`Amount: ${amount}`);
if (employeeAccountNumber) console.log(`Employee Account: ${employeeAccountNumber}`);
console.log("Copy this file to the Employee PC and upload it via the Top-Up button.");
