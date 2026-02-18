import Database from 'better-sqlite3';
import path from 'path';

// Admin tracking database - in proper db directory
const adminDbPath = path.join(process.cwd(), 'db', 'admin_tracking.db');
export const adminDb = new Database(adminDbPath);

console.log('👨‍💼 Admin Database initialized at:', adminDbPath);

// Initialize database schema
adminDb.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    accountNumber TEXT UNIQUE NOT NULL,
    adminGeneratedBalance TEXT DEFAULT '0',
    employeePaidAmount TEXT DEFAULT '0',
    totalRechargeFiles INTEGER DEFAULT 0,
    totalRechargeAmount TEXT DEFAULT '0',
    createdAt TEXT NOT NULL,
    shopId TEXT,
    isBlocked BOOLEAN DEFAULT 0,
    role TEXT DEFAULT 'employee' -- Add role field with default 'employee'
  );

  CREATE TABLE IF NOT EXISTS admin_recharge_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    fileData TEXT NOT NULL,
    signature TEXT NOT NULL,
    employeeId INTEGER,
    amount REAL NOT NULL,
    createdAt TEXT NOT NULL,
    usedAt TEXT,
    shopId TEXT
  );
`);
