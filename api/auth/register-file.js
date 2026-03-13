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
      encryptedDataLength: encryptedData ? encryptedData.length : 0
    });

    if (!encryptedData) {
      console.log('❌ Missing encrypted data:', { encryptedData });
      return res.status(400).json({ message: 'Encrypted data is required' });
    }

    // Generate filename for the registration file
    const timestamp = Date.now();
    const filename = `registration_${timestamp}.enc`;

    console.log('✅ Registration file processed:', filename);

    res.status(200).json({
      message: 'Registration file processed successfully',
      filename: filename,
      encryptedData: encryptedData,
      processedAt: new Date().toISOString()
    });

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
