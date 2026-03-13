#!/usr/bin/env node

/**
 * Standalone admin tracking data endpoint
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

    console.log('📈 Admin tracking data request');

    // Get basic tracking data
    const usersResult = await pool.query('SELECT COUNT(*) as total_users FROM users');
    const gamesResult = await pool.query('SELECT COUNT(*) as total_games FROM games');
    const revenueResult = await pool.query('SELECT COALESCE(SUM(amount), 0) as total_revenue FROM transactions WHERE type = \'credit_load\'');

    res.status(200).json({
      totalUsers: parseInt(usersResult.rows[0].total_users),
      totalGames: parseInt(gamesResult.rows[0].total_games),
      totalRevenue: parseFloat(revenueResult.rows[0].total_revenue)
    });

  } catch (error) {
    console.error('❌ Tracking data error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    await pool.end();
  }
}
