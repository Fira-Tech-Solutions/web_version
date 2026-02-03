
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Usage: ts-node scripts/generate_balance_file.ts <amount> <shopId>
const args = process.argv.slice(2);

if (args.length < 2) {
    console.error("Usage: ts-node scripts/generate_balance_file.ts <amount> <shopId>");
    process.exit(1);
}

const amount = parseFloat(args[0]);
const shopId = parseInt(args[1]);

if (isNaN(amount) || isNaN(shopId)) {
    console.error("Invalid amount or shopId");
    process.exit(1);
}

const privateKeyPath = path.join(process.cwd(), 'keys', 'private_key.pem');
if (!fs.existsSync(privateKeyPath)) {
    console.error("Private key not found. Run generate_keys.ts first.");
    process.exit(1);
}

const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

const nonce = crypto.randomBytes(16).toString('hex');
const timestamp = Date.now();

const payload = {
    amount,
    shopId,
    nonce,
    timestamp
};

// Sign the data (amount:shopId:nonce:timestamp)
const dataToSign = `${amount}:${shopId}:${nonce}:${timestamp}`;

const signature = crypto.sign("sha256", Buffer.from(dataToSign), privateKey).toString('base64');

const outputFile = {
    payload,
    signature
};

const fileName = `balance_${shopId}_${timestamp}.json`;
fs.writeFileSync(fileName, JSON.stringify(outputFile, null, 2));

console.log(`Balance file generated: ${fileName}`);
console.log(`Amount: ${amount}, Shop ID: ${shopId}, Nonce: ${nonce}`);
console.log(`(This implementation uses Digital Signatures. The file confirms a credit load from Admin)`);
