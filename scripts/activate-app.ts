import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import UltimateMachineIdGenerator from '../server/src/lib/ultimate-machine-id';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'license.db');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

async function getMachineId(): Promise<string> {
  const generator = UltimateMachineIdGenerator.getInstance();
  return generator.getMachineId();
}

async function activateApp() {
  ensureDataDir();
  const db = new Database(DB_PATH);
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS activation (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      machine_id TEXT NOT NULL UNIQUE,
      activated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS used_tokens (
      transaction_id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      employee_id INTEGER,
      redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recharge_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL,
      amount REAL NOT NULL,
      employee_id INTEGER,
      redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS used_recharges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_signature TEXT NOT NULL UNIQUE,
      transaction_id TEXT NOT NULL,
      amount REAL NOT NULL,
      employee_id INTEGER,
      machine_id TEXT NOT NULL,
      used_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Get ultimate machine ID
  const machineId = await getMachineId();

  // Activate the app
  db.prepare(
    "INSERT OR REPLACE INTO activation (id, machine_id, activated_at) VALUES (1, ?, datetime('now'))"
  ).run(machineId);

  console.log('✅ Application activated successfully!');
  console.log(`📝 Machine ID: ${machineId}`);
  
  db.close();
}

activateApp().catch(console.error);
