#!/usr/bin/env node

/**
 * Standalone admin employees generate account file endpoint
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    const { employeeId } = req.body;
    
    if (!employeeId) {
      return res.status(400).json({ message: 'Employee ID required' });
    }

    console.log('📄 Generate account file request:', { employeeId });

    // Get employee data
    const empResult = await pool.query('SELECT * FROM users WHERE id = $1', [employeeId]);
    
    if (empResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const employee = empResult.rows[0];
    
    // Create a simple account file response
    const fileData = {
      username: employee.username,
      name: employee.name,
      balance: employee.balance,
      role: employee.role,
      generatedAt: new Date().toISOString(),
      employeeId: employee.id
    };

    console.log('✅ Account file generated for:', employee.username);

    res.status(200).json({
      message: 'Account file generated successfully',
      employee: {
        id: employee.id,
        username: employee.username,
        name: employee.name,
        balance: employee.balance,
        role: employee.role
      },
      fileData: fileData
    });

  } catch (error) {
    console.error('❌ Generate account file error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    await pool.end();
  }
}
