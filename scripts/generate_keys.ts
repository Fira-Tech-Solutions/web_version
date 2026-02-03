
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Generate RSA Keys
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
    },
});

const keysDir = path.join(process.cwd(), 'keys');
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir);
}

fs.writeFileSync(path.join(keysDir, 'private_key.pem'), privateKey);
fs.writeFileSync(path.join(keysDir, 'public_key.pem'), publicKey);

console.log('Keys generated successfully in ./keys/ directory.');
