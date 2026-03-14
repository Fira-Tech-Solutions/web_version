#!/usr/bin/env node

/**
 * Standalone auth register-file endpoint
 */

import { Pool } from 'pg';
import * as crypto from 'crypto';

// RSA encryption function (standalone version)
function encryptData(data) {
  const SECRET_KEY = process.env.ENCRYPTION_SECRET || "bingo-master-secure-shared-secret-key-32";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(SECRET_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

// RSA signature function (standalone version)
function signData(data, privateKey) {
  const signer = crypto.createSign("sha256");
  signer.update(JSON.stringify(data));
  signer.end();
  return signer.sign(privateKey, "hex");
}

// RSA decryption function (standalone version)
function decryptData(encryptedString) {
  const SECRET_KEY = process.env.ENCRYPTION_SECRET || "bingo-master-secure-shared-secret-key-32";
  const [ivHex, encryptedHex] = encryptedString.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(SECRET_KEY.padEnd(32).slice(0, 32)), iv);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
}

// RSA signature verification function (standalone version)
function verifyData(data, signature, publicKey) {
  const verifier = crypto.createVerify("sha256");
  verifier.update(JSON.stringify(data));
  verifier.end();
  return verifier.verify(publicKey, signature, "hex");
}

export default async function handler(req, res) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    // Handle Vercel body parsing
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        console.log('❌ Failed to parse body:', e);
        return res.status(400).json({ message: 'Invalid JSON in request body' });
      }
    }

    const { encryptedData } = body;
    
    console.log('📄 Register file request:', { 
      encryptedDataProvided: !!encryptedData,
      encryptedDataLength: encryptedData ? encryptedData.length : 0,
      encryptedDataType: typeof encryptedData,
      encryptedDataPreview: encryptedData ? encryptedData.substring(0, 100) + '...' : 'null'
    });

    if (!encryptedData) {
      console.log('❌ Missing encrypted data:', { encryptedData });
      return res.status(400).json({ message: 'Encrypted data is required' });
    }

    // Check if it's a simple JSON string (not encrypted)
    if (encryptedData.startsWith('{') || encryptedData.startsWith('[')) {
      console.log('🔓 Data appears to be unencrypted JSON, treating as direct payload');
      try {
        let payload;
        
        // Try to parse as JSON directly first
        try {
          payload = JSON.parse(encryptedData);
        } catch (firstParseError) {
          // If that fails, it might be double-encoded JSON
          try {
            const decodedOnce = JSON.parse(encryptedData);
            payload = typeof decodedOnce === 'string' ? JSON.parse(decodedOnce) : decodedOnce;
          } catch (secondParseError) {
            throw new Error('Unable to parse registration data as JSON');
          }
        }
        
        if (!payload || !payload.username || !payload.password) {
          console.log('❌ Invalid payload:', payload);
          return res.status(400).json({ message: 'Invalid registration file payload' });
        }

        console.log('👤 Creating user from JSON payload:', { 
          username: payload.username,
          fullName: payload.fullName,
          initialBalance: payload.initialBalance
        });

        // Check if user already exists
        const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [payload.username]);
        if (existingUser.rows.length > 0) {
          console.log('⚠️ User already exists:', payload.username);
          return res.status(409).json({ message: 'User already exists' });
        }

        // Hash password
        const bcrypt = require('bcrypt');
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(payload.password, saltRounds);

        // Create user in database
        const result = await pool.query(
          `INSERT INTO users (username, password, name, balance, role, is_blocked, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
           RETURNING id, username, name, balance, role`,
          [
            payload.username,
            hashedPassword,
            payload.fullName || payload.username,
            parseFloat(payload.initialBalance) || 0,
            'employee',
            false
          ]
        );

        const createdUser = result.rows[0];
        console.log('✅ User created successfully from JSON:', createdUser.username);

        // Generate filename for registration file
        const timestamp = Date.now();
        const filename = `registration_${payload.username}_${timestamp}.json`;

        res.status(200).json({
          message: 'Registration successful',
          filename: filename,
          username: createdUser.username,
          user: {
            id: createdUser.id,
            username: createdUser.username,
            name: createdUser.name,
            balance: createdUser.balance,
            role: createdUser.role
          },
          processedAt: new Date().toISOString()
        });
        return;

      } catch (jsonError) {
        console.log('❌ Failed to parse JSON payload:', jsonError);
        return res.status(400).json({ message: 'Invalid JSON format in registration file' });
      }
    }

    try {
      // Decrypt the file content
      const fileContent = decryptData(encryptedData);
      console.log('🔓 File content decrypted:', { 
        hasPayload: !!fileContent.payload,
        hasSignature: !!fileContent.signature
      });

      const { payload, signature } = fileContent;
      
      if (!payload || !payload.username || !payload.password) {
        console.log('❌ Invalid payload:', payload);
        return res.status(400).json({ message: 'Invalid registration file payload' });
      }

      console.log('👤 Creating user:', { 
        username: payload.username,
        fullName: payload.fullName,
        initialBalance: payload.initialBalance
      });

      // Check if user already exists
      const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [payload.username]);
      if (existingUser.rows.length > 0) {
        console.log('⚠️ User already exists:', payload.username);
        return res.status(409).json({ message: 'User already exists' });
      }

      // Hash the password
      const bcrypt = require('bcrypt');
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(payload.password, saltRounds);

      // Create the user in database
      const result = await pool.query(
        `INSERT INTO users (username, password, name, balance, role, is_blocked, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
         RETURNING id, username, name, balance, role`,
        [
          payload.username,
          hashedPassword,
          payload.fullName || payload.username,
          parseFloat(payload.initialBalance) || 0,
          'employee',
          false
        ]
      );

      const createdUser = result.rows[0];
      console.log('✅ User created successfully:', createdUser.username);

      // Generate filename for the registration file
      const timestamp = Date.now();
      const filename = `registration_${payload.username}_${timestamp}.enc`;

      res.status(200).json({
        message: 'Registration successful',
        filename: filename,
        username: createdUser.username,
        user: {
          id: createdUser.id,
          username: createdUser.username,
          name: createdUser.name,
          balance: createdUser.balance,
          role: createdUser.role
        },
        processedAt: new Date().toISOString()
      });

    } catch (decryptError) {
      console.log('❌ Decryption failed:', decryptError);
      return res.status(400).json({ message: 'Invalid or corrupted registration file' });
    }

  } catch (error) {
    console.error('❌ Register file error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    await pool.end();
  }
}
