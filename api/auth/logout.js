#!/usr/bin/env node

/**
 * Standalone auth logout endpoint
 */

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    // For standalone mode, just return success
    // In a real app, you'd clear the session/token
    res.status(200).json({ message: 'Logout successful' });

  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
}
