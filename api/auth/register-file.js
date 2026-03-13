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

    const { fullName, username, password, initialBalance, privateKey } = body;
    
    console.log('📄 Register file request:', { 
      fullName, 
      username, 
      passwordProvided: !!password, 
      initialBalance,
      privateKeyProvided: !!privateKey 
    });

    if (!fullName || !username || !password || initialBalance === undefined) {
      console.log('❌ Missing required fields:', { fullName, username, passwordProvided: !!password, initialBalance });
      return res.status(400).json({ message: 'Full name, username, password, and initial balance are required' });
    }

    // Create registration file payload
    const payload = {
      fullName,
      username,
      password, // Include password for registration file
      initialBalance: parseFloat(initialBalance),
      role: 'employee',
      generatedAt: new Date().toISOString(),
      fileType: 'registration_file',
      version: '1.0',
      nonce: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now()
    };

    // Generate RSA signature (using provided private key or fallback)
    let signature;
    if (privateKey) {
      try {
        signature = signData(payload, privateKey);
      } catch (e) {
        console.log('❌ RSA signing failed:', e);
        return res.status(400).json({ message: 'Invalid private key for signing' });
      }
    } else {
      // For demo purposes, create a mock signature
      signature = 'mock_signature_' + crypto.randomBytes(32).toString('hex');
    }

    // Create file content with payload and signature
    const fileContent = {
      payload,
      signature
    };

    // Encrypt the file content
    const encryptedData = encryptData(fileContent);

    // Generate .enc filename
    const filename = `${username}_registration_${Date.now()}.enc`;

    console.log('✅ Registration file generated for:', username);

    res.status(200).json({
      message: 'Registration file generated successfully',
      employee: {
        fullName,
        username,
        initialBalance: parseFloat(initialBalance),
        role: 'employee'
      },
      filename: filename,
      encryptedData: encryptedData,
      signature: signature,
      payload: payload
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
