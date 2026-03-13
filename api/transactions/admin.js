#!/usr/bin/env node

/**
 * Standalone transactions endpoint for admin
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    console.log('📊 Admin transactions request');

    // Get all transactions for admin view
    const result = await pool.query(`
      SELECT t.*, u.username 
      FROM transactions t 
      LEFT JOIN users u ON t.user_id = u.id 
      ORDER BY t.created_at DESC 
      LIMIT 100
    `);

    res.status(200).json({
      transactions: result.rows
    });

  } catch (error) {
    console.error('❌ Transactions error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    await pool.end();
  }
}
