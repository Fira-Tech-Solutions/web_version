#!/usr/bin/env node

/**
 * Active games API endpoint
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

    // Get active games
    let result;
    try {
      result = await pool.query(`
        SELECT g.*, 
               COUNT(p.id) as player_count,
               COUNT(CASE WHEN p.status = 'winner' THEN 1 END) as winners_count
        FROM games g
        LEFT JOIN players p ON g.id = p.game_id
        WHERE g.status = 'active'
        GROUP BY g.id, g.name, g.status, g.created_at, g.updated_at
        ORDER BY g.created_at DESC
      `);
    } catch (tableError) {
      console.log('⚠️ Players table not found, returning games without player counts');
      // Fallback to games without player data
      result = await pool.query(`
        SELECT *, 0 as player_count, 0 as winners_count
        FROM games 
        WHERE status = 'active'
        ORDER BY created_at DESC
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

    console.log(`✅ Retrieved ${games.length} active games`);

    res.status(200).json({
      games: games,
      count: games.length
    });

  } catch (error) {
    console.error('❌ Active games error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    await pool.end();
  }
}
