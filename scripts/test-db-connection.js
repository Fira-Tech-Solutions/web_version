#!/usr/bin/env node

/**
 * Test Database Connection
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://7494ef1e6e1659bc4b1f951242b1733f0058d762b51259b7ae17d92ea4a2bb30:sk_W0TddwplDabfmO8HvglXo@db.prisma.io:5432/postgres?sslmode=require',
});

async function testConnection() {
  try {
    console.log('🔗 Testing database connection...');
    
    const result = await pool.query('SELECT NOW() as time');
    console.log('✅ Database connected successfully:', result.rows[0].time);
    
    // Check if admin user exists
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    console.log('👤 Admin user check:', userResult.rows.length > 0 ? 'Found' : 'Not found');
    
    if (userResult.rows.length > 0) {
      const admin = userResult.rows[0];
      console.log('📋 Admin details:', {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        name: admin.name,
        balance: admin.balance
      });
    }
    
    // List all tables
    const tablesResult = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `);
    console.log('📋 Tables:', tablesResult.rows.map(r => r.tablename));
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();
