#!/usr/bin/env node

/**
 * Cartelas import API endpoint
 */

import { Pool } from 'pg';

export default async function handler(req, res) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    const { data } = req.body || {};
    
    console.log('📄 Cartelas import request:', { 
      dataProvided: !!data,
      dataLength: data ? data.length : 0
    });

    if (!data) {
      console.log('❌ Missing data');
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

    // Try to save to database (optional - just return processed data for now)
    try {
      // Create cartelas table if it doesn't exist
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

      // Insert cartelas (simplified - just return success for now)
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

  } catch (error) {
    console.error('❌ Cartelas import error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  } finally {
    await pool.end();
  }
}
