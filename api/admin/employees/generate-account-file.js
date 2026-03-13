#!/usr/bin/env node

/**
 * Standalone admin employees generate account file endpoint
 */

import { Pool } from 'pg';

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
    
    console.log('📄 Generate account file request:', { 
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

    // Create account file data for new employee (not creating user in DB)
    const fileData = {
      fullName,
      username,
      initialBalance: parseFloat(initialBalance),
      generatedAt: new Date().toISOString(),
      fileType: 'employee_account',
      version: '1.0'
    };

    console.log('✅ Account file generated for new employee:', username);

    res.status(200).json({
      message: 'Account file generated successfully',
      employee: {
        fullName,
        username,
        initialBalance: parseFloat(initialBalance),
        role: 'employee'
      },
      fileData: fileData
    });

  } catch (error) {
    console.error('❌ Generate account file error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    await pool.end();
  }
}
