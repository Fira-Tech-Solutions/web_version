#!/usr/bin/env node

/**
 * Standalone admin employees endpoint
 */

import { Pool } from 'pg';

export default async function handler(req, res) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('👥 Admin employees request:', req.method);

    if (req.method === 'GET') {
      // Get all employees
      const result = await pool.query('SELECT id, username, name, role, balance, is_blocked, created_at FROM users WHERE role IN (\'employee\', \'admin\') ORDER BY created_at DESC');
      
      res.status(200).json({
        employees: result.rows
      });
    } else if (req.method === 'POST') {
      // Generate account file
      const { employeeId } = req.body;
      
      if (!employeeId) {
        return res.status(400).json({ message: 'Employee ID required' });
      }

      // Get employee data
      const empResult = await pool.query('SELECT * FROM users WHERE id = $1', [employeeId]);
      
      if (empResult.rows.length === 0) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      const employee = empResult.rows[0];
      
      // Create a simple account file response
      res.status(200).json({
        message: 'Account file generated',
        employee: {
          id: employee.id,
          username: employee.username,
          name: employee.name,
          balance: employee.balance
        },
        fileData: {
          username: employee.username,
          balance: employee.balance,
          generatedAt: new Date().toISOString()
        }
      });
    } else {
      return res.status(405).json({ message: 'Method not allowed' });
    }

  } catch (error) {
    console.error('❌ Employees error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    await pool.end();
  }
}
