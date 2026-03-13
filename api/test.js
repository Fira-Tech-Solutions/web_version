#!/usr/bin/env node

/**
 * Test API endpoint for debugging
 */

import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  try {
    console.log('🔍 Test endpoint called');
    console.log('📋 Environment variables:', {
      DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
      ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET ? 'Set' : 'Not set',
      NODE_ENV: process.env.NODE_ENV
    });

    // Test database connection
    const result = await pool.query('SELECT NOW() as time');
    console.log('✅ Database connected:', result.rows[0].time);

    // Test admin user
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    console.log('👤 Admin user found:', userResult.rows.length > 0);

    if (userResult.rows.length > 0) {
      const admin = userResult.rows[0];
      console.log('📋 Admin details:', {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        passwordHash: admin.password.startsWith('$2b$') ? 'Hashed' : 'Plain'
      });

      // Test password verification
      const isValid = await bcrypt.compare('admin123', admin.password);
      console.log('🔐 Password verification:', isValid);
    }

    res.status(200).json({
      success: true,
      message: 'Test completed successfully',
      database: 'Connected',
      adminUser: userResult.rows.length > 0 ? 'Found' : 'Not found',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    await pool.end();
  }
}
