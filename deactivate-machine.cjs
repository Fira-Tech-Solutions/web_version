#!/usr/bin/env node

/**
 * Script to deactivate current machine for testing activation files
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'data', 'license.db');

try {
  const db = new Database(DB_PATH);
  
  // Get current activation
  const currentActivation = db.prepare('SELECT machine_id FROM activation LIMIT 1').get();
  
  if (currentActivation) {
    console.log(`Current activation found for machine: ${currentActivation.machine_id}`);
    
    // Delete the activation
    const result = db.prepare('DELETE FROM activation WHERE machine_id = ?').run(currentActivation.machine_id);
    
    if (result.changes > 0) {
      console.log('✅ Machine deactivated successfully!');
      console.log(`📝 Removed activation for: ${currentActivation.machine_id}`);
      console.log('🔓 Your machine is now ready for activation file testing');
    } else {
      console.log('❌ Failed to deactivate machine');
    }
  } else {
    console.log('ℹ️  No activation found - machine is already deactivated');
  }
  
  db.close();
  
} catch (error) {
  console.error('❌ Error deactivating machine:', error.message);
  process.exit(1);
}
