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

    const { data } = body;
    
    console.log('📄 Cartelas import request:', { 
      dataProvided: !!data,
      dataLength: data ? data.length : 0,
      preview: data ? data.substring(0, 100) + '...' : 'null'
    });

    if (!data) {
      console.log('❌ Missing data:', { data });
      return res.status(400).json({ message: 'Cartelas data is required' });
    }

    // Parse CSV data (simplified for demo)
    const lines = data.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    const cartelas = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length >= 7) {
        const cartela = {
          cno: values[0]?.replace(/"/g, ''),
          userId: values[1]?.replace(/"/g, ''),
          cardNo: values[2]?.replace(/"/g, ''),
          b: values[3]?.replace(/"/g, ''),
          i: values[4]?.replace(/"/g, ''),
          n: values[5]?.replace(/"/g, ''),
          g: values[6]?.replace(/"/g, ''),
          o: values.length > 7 ? values[7]?.replace(/"/g, '') : ''
        };
        cartelas.push(cartela);
      }
    }

    console.log(`✅ Parsed ${cartelas.length} cartelas for import`);

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
