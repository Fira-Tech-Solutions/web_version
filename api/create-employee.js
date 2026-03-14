#!/usr/bin/env node

/**
 * Create employee user API endpoint
 */

import { Pool } from 'pg';
import bcrypt from 'bcrypt';

export default async function handler(req, res) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    if (req.method !== 'POST') {
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

    const { username, password, fullName, initialBalance } = body;
    
    console.log('📄 Create employee request:', { 
      username: 'adisbingo',
      password: 'adis@bingo',
      fullName: 'Adis Bingo',
      initialBalance: 1000000
    });

    // Use provided credentials
    const employeeUsername = 'adisbingo';
    const employeePassword = 'adis@bingo';
    const employeeFullName = 'Adis Bingo';
    const employeeInitialBalance = 1000000;

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [employeeUsername]);
    if (existingUser.rows.length > 0) {
      console.log('⚠️ User already exists, updating...');
      
      // Update existing user
      const hashedPassword = await bcrypt.hash(employeePassword, 10);
      await pool.query(
        'UPDATE users SET password = $1, name = $2, balance = $3 WHERE username = $4',
        [hashedPassword, employeeFullName, employeeInitialBalance, employeeUsername]
      );
      
      console.log('✅ User updated successfully');
      return res.status(200).json({
        message: 'Employee user updated successfully',
        username: employeeUsername,
        fullName: employeeFullName,
        balance: employeeInitialBalance,
        action: 'updated'
      });
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(employeePassword, 10);
    
    const result = await pool.query(
      `INSERT INTO users (username, password, name, balance, role, is_blocked, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
         RETURNING id, username, name, balance, role`,
      [
        employeeUsername,
        hashedPassword,
        employeeFullName,
        employeeInitialBalance,
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

    res.status(200).json({
      message: 'Employee user created successfully',
      username: employeeUsername,
      fullName: employeeFullName,
      balance: employeeInitialBalance,
      user: {
        id: createdUser.id,
        username: createdUser.username,
        name: createdUser.name,
        balance: createdUser.balance,
        role: createdUser.role
      },
      action: 'created'
    });

  } catch (error) {
    console.error('❌ Create employee error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    await pool.end();
  }
}
