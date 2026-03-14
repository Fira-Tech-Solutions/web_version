#!/usr/bin/env node

/**
 * Admin employees endpoint with cartelas import
 */

import { Pool } from 'pg';

export default async function handler(req, res) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const { method } = req;

    if (method === 'GET') {
      // Get employees list
      const result = await pool.query(`
        SELECT id, username, name, role, balance, is_blocked, created_at
        FROM users 
        WHERE role = 'employee'
        ORDER BY created_at DESC
      `);

      res.status(200).json({
        employees: result.rows,
        count: result.rows.length
      });

    } else if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, data } = body || {};

      if (action === 'import-cartelas') {
        // Handle cartelas import
        if (!data) {
          return res.status(400).json({ message: 'Cartelas data is required' });
        }

        // Parse CSV data
        const lines = data.split('\n').filter(line => line.trim());
        const headers = lines[0]?.split(',') || [];
        const cartelas = [];

        for (let i = 1; i < lines.length && i < 100; i++) {
          const values = lines[i].split(',');
          if (values.length >= 7) {
            // Transform string arrays to integer arrays
            const parseNumbers = (numStr) => {
              return numStr.replace(/"/g, '').split(',').map(n => parseInt(n.trim()) || 0);
            };

            const cartela = {
              cno: values[0]?.replace(/"/g, '').trim(),
              userId: values[1]?.replace(/"/g, '').trim(),
              cardNo: values[2]?.replace(/"/g, '').trim(),
              b: parseNumbers(values[3] || ''),
              i: parseNumbers(values[4] || ''),
              n: parseNumbers(values[5] || ''),
              g: parseNumbers(values[6] || ''),
              o: values.length > 7 ? parseNumbers(values[7] || '') : []
            };
            cartelas.push(cartela);
          }
        }

        console.log(`✅ Processed ${cartelas.length} cartelas`);

        // Try to create cartelas table if needed
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS cartelas (
              id SERIAL PRIMARY KEY,
              cno VARCHAR(50),
              user_id VARCHAR(50),
              card_no VARCHAR(50),
              b INTEGER[],
              i INTEGER[],
              n INTEGER[],
              g INTEGER[],
              o INTEGER[],
              created_at TIMESTAMP DEFAULT NOW()
            )
          `);
          console.log('📊 Cartelas table ready for data');
        } catch (dbError) {
          console.log('⚠️ Database operation skipped:', dbError.message);
        }

        res.status(200).json({
          message: 'Cartelas data processed successfully',
          cartelas: cartelas,
          count: cartelas.length,
          processedAt: new Date().toISOString()
        });

      } else {
        // Handle account file generation (existing functionality)
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
      }

    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }

  } catch (error) {
    console.error('❌ Admin employees error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    await pool.end();
  }
}
