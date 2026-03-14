#!/usr/bin/env node

/**
 * Create temporary employee user for testing
 */

import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createEmployee() {
  try {
    const username = 'adisbingo';
    const password = 'adis@bingo';
    const initialBalance = 1000000;
    const fullName = 'Adis Bingo';

    console.log('🔧 Creating employee user:', { username, fullName, initialBalance });

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      console.log('⚠️ User already exists, updating...');
      
      // Update existing user
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        'UPDATE users SET password = $1, name = $2, balance = $3 WHERE username = $4',
        [hashedPassword, fullName, initialBalance, username]
      );
      
      console.log('✅ User updated successfully');
    } else {
      // Create new user
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const result = await pool.query(
        `INSERT INTO users (username, password, name, balance, role, is_blocked, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
         RETURNING id, username, name, balance, role`,
        [
          username,
          hashedPassword,
          fullName,
          initialBalance,
          'employee',
          false
        ]
      );

      const createdUser = result.rows[0];
      console.log('✅ Employee user created successfully:', {
        id: createdUser.id,
        username: createdUser.username,
        name: createdUser.name,
        balance: createdUser.balance,
        role: createdUser.role
      });
    }

  } catch (error) {
    console.error('❌ Error creating employee:', error);
  } finally {
    await pool.end();
  }
}

createEmployee();
