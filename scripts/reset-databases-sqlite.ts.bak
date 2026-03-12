import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcrypt';
import fs from 'fs';
import { adminDb } from './admin-db';
import { employeeDb } from './employee-db';

// Paths to both databases - in proper db directory
const dbDir = path.join(process.cwd(), 'db');
const employeeDbPath = path.join(dbDir, 'bingo.db');
const adminDbPath = path.join(dbDir, 'admin_tracking.db');

console.log('🗄️  Resetting both databases...');

// Ensure db directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('✅ Created db directory');
}

// Clear employee database
if (fs.existsSync(employeeDbPath)) {
  fs.unlinkSync(employeeDbPath);
  console.log('✅ Employee database cleared');
}

// Clear admin tracking database
if (fs.existsSync(adminDbPath)) {
  fs.unlinkSync(adminDbPath);
  console.log('✅ Admin tracking database cleared');
}

// Initialize fresh databases
const freshEmployeeDb = new Database(employeeDbPath);
const freshAdminDb = new Database(adminDbPath);

// Create employee database tables
freshEmployeeDb.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    name TEXT,
    shopId TEXT,
    accountNumber TEXT UNIQUE,
    balance TEXT DEFAULT '0.00',
    isBlocked BOOLEAN DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    createdBy INTEGER NOT NULL,
    gameType TEXT NOT NULL DEFAULT 'bingo',
    status TEXT NOT NULL DEFAULT 'waiting',
    currentNumber INTEGER,
    numbersCalled TEXT,
    winnerId INTEGER,
    prizeAmount TEXT DEFAULT '0.00',
    systemCut TEXT DEFAULT '0.00',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    completedAt DATETIME,
    FOREIGN KEY (createdBy) REFERENCES users(id),
    FOREIGN KEY (winnerId) REFERENCES users(id)
  );

  CREATE TABLE game_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gameId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    cartelaNumbers TEXT,
    isWinner BOOLEAN DEFAULT 0,
    prizeWon TEXT DEFAULT '0.00',
    systemCut TEXT DEFAULT '0.00',
    joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gameId) REFERENCES games(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount TEXT NOT NULL,
    description TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE game_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gameId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gameId) REFERENCES games(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE daily_revenue_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    totalRevenue TEXT DEFAULT '0.00',
    totalGames INTEGER DEFAULT 0,
    totalPlayers INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE cartelas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gameId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    numbers TEXT NOT NULL,
    pattern TEXT,
    isWinner BOOLEAN DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gameId) REFERENCES games(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

// Create admin tracking database tables
freshAdminDb.exec(`
  CREATE TABLE admin_users (
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
    isBlocked BOOLEAN DEFAULT 0
  );

  CREATE TABLE admin_recharge_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    accountNumber TEXT NOT NULL,
    amount TEXT NOT NULL,
    filename TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    shopId TEXT
  );
`);

// Create admin user
async function createAdminUser() {
  const adminUsername = 'admin';
  const adminPassword = 'admin123';

  // Insert into admin tracking database ONLY (for admin operations)
  const adminStmt = freshAdminDb.prepare(`
    INSERT INTO admin_users (username, password, name, accountNumber, adminGeneratedBalance, employeePaidAmount, createdAt, isBlocked)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const trackingResult = adminStmt.run(
    adminUsername,
    adminPassword, // Plain text for admin view
    'System Administrator',
    'ADMIN-001',
    '0',
    '0',
    new Date().toISOString(),
    0 // SQLite boolean: 0 = false
  );

  console.log('✅ Admin user created in admin tracking database');
  console.log(`   Username: ${adminUsername}`);
  console.log(`   Password: ${adminPassword}`);
  console.log(`   Tracking ID: ${trackingResult.lastInsertRowid}`);
}

// Create the admin user
createAdminUser().then(() => {
  console.log('\n🎉 Database reset completed successfully!');
  console.log('\n📝 Login Credentials:');
  console.log('   Username: admin');
  console.log('   Password: admin123');
  console.log('\n💡 You can now start the server and login with these credentials.');
  
  // Close databases
  freshEmployeeDb.close();
  freshAdminDb.close();
}).catch(error => {
  console.error('❌ Error creating admin user:', error);
  process.exit(1);
});
