#!/usr/bin/env node

/**
 * Standalone auth endpoint for debugging
 */

import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    console.log('🔐 Login attempt:', { username, passwordLength: password.length });

    // Direct database query without storage layer
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      console.log('❌ User not found:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    console.log('👤 User found:', { 
      id: user.id, 
      username: user.username, 
      role: user.role,
      passwordHash: user.password.startsWith('$2b$') ? 'Hashed' : 'Plain'
    });

    // Check password
    const isHashedPassword = user.password.startsWith('$2b$');
    let isValidPassword = false;

    if (isHashedPassword) {
      isValidPassword = await bcrypt.compare(password, user.password);
    } else {
      isValidPassword = password === user.password;
    }

    console.log('🔐 Password verification:', isValidPassword);

    if (!isValidPassword) {
      console.log('❌ Password mismatch');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Success
    console.log('✅ Login successful for:', username);
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        balance: user.balance
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    await pool.end();
  }
}
