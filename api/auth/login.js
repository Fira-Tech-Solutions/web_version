#!/usr/bin/env node

/**
 * Standalone auth login endpoint
 */

import { Pool } from 'pg';
import bcrypt from 'bcrypt';

export default async function handler(req, res) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔐 AUTH LOGIN REQUEST:', {
      method: req.method,
      headers: req.headers,
      body: req.body,
      url: req.url
    });

    if (req.method !== 'POST') {
      console.log('❌ Method not allowed:', req.method);
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

    const { username, password } = body;

    console.log('🔐 Parsed credentials:', { 
      usernameProvided: !!username, 
      passwordProvided: !!password,
      username: username || 'missing',
      passwordLength: password ? password.length : 0
    });

    if (!username || !password) {
      console.log('❌ Missing credentials:', { username, passwordProvided: !!password });
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
    
    const response = {
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        balance: user.balance,
        isBlocked: user.is_blocked
      }
    };

    console.log('📤 Sending response:', response);
    
    // Set session-like headers for frontend compatibility
    res.setHeader('Set-Cookie', 'session=authenticated; HttpOnly; Secure; SameSite=Strict; Path=/');
    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    await pool.end();
  }
}
