#!/usr/bin/env node

/**
 * Simple test endpoint to verify routing
 */

export default async function handler(req, res) {
  try {
    console.log('🧪 TEST ENDPOINT HIT:', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    });

    res.status(200).json({
      message: 'Test endpoint working',
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url
    });

  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    res.status(500).json({ 
      message: 'Test endpoint error',
      error: error.message 
    });
  }
}
