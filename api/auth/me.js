#!/usr/bin/env node

/**
 * Standalone auth me endpoint
 */

import { Pool } from 'pg';

export default async function handler(req, res) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    // For now, return the admin user (since we don't have sessions in standalone mode)
    // In a real app, you'd extract user info from session/token
    const result = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = result.rows[0];
    
    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        balance: user.balance,
        isBlocked: user.is_blocked
      }
    });

  } catch (error) {
    console.error('❌ Get current user error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    await pool.end();
  }
}
