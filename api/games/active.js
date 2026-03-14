#!/usr/bin/env node

/**
 * Games API endpoint - handles both active and history
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

    const { type } = req.query || {};
    const isActive = type !== 'history';

    // Get games
    let result;
    try {
      const whereClause = isActive ? "WHERE g.status = 'active'" : "";
      const orderBy = "ORDER BY g.created_at DESC";
      const limit = isActive ? "" : "LIMIT 50";

      result = await pool.query(`
        SELECT g.*, 
               COUNT(p.id) as player_count,
               COUNT(CASE WHEN p.status = 'winner' THEN 1 END) as winners_count
        FROM games g
        LEFT JOIN players p ON g.id = p.game_id
        ${whereClause}
        GROUP BY g.id, g.name, g.status, g.created_at, g.updated_at
        ${orderBy}
        ${limit}
      `);
    } catch (tableError) {
      console.log('⚠️ Players table not found, returning games without player counts');
      const whereClause = isActive ? "WHERE status = 'active'" : "";
      const orderBy = "ORDER BY created_at DESC";
      const limit = isActive ? "" : "LIMIT 50";

      result = await pool.query(`
        SELECT *, 0 as player_count, 0 as winners_count
        FROM games 
        ${whereClause}
        ${orderBy}
        ${limit}
      `);
    }

    const games = result.rows.map(game => ({
      id: game.id,
      name: game.name,
      status: game.status,
      playerCount: parseInt(game.player_count) || 0,
      winnersCount: parseInt(game.winners_count) || 0,
      createdAt: game.created_at,
      updatedAt: game.updated_at
    }));

    const endpoint = isActive ? 'active' : 'history';
    console.log(`✅ Retrieved ${games.length} games from ${endpoint}`);

    res.status(200).json({
      games: games,
      count: games.length,
      type: endpoint
    });

  } catch (error) {
    console.error('❌ Games error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    await pool.end();
  }
}
