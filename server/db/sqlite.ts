import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema-simple";
import path from 'path';
import { app } from 'electron';

// Determine database path based on environment
const getDatabasePath = () => {
  if (process.type === 'browser' || (process.versions && process.versions.electron)) {
    // Running in Electron - use userData directory
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'bingo.db');
  } else {
    // Running in development/regular Node.js - use current directory
    return 'bingo.db';
  }
};

// Initialize SQLite database
const dbPath = getDatabasePath();
console.log('Database path:', dbPath);
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

// Create tables if they don't exist
function createTables() {
  // Users table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      name TEXT NOT NULL,
      email TEXT,
      account_number TEXT UNIQUE,
      balance REAL DEFAULT 0,
      is_blocked INTEGER DEFAULT 0,
      credit_balance REAL DEFAULT 0,
      referred_by INTEGER,
      commission_rate REAL DEFAULT 0,
      profit_margin REAL DEFAULT 20,
      total_revenue REAL DEFAULT 0,
      total_games INTEGER DEFAULT 0,
      total_players INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT 0
    )
  `);

  // Games table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      prize_pool REAL DEFAULT 0,
      entry_fee REAL NOT NULL,
      called_numbers TEXT DEFAULT '[]',
      winner_id INTEGER,
      started_at INTEGER DEFAULT 0,
      completed_at INTEGER DEFAULT 0,
      is_paused INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT 0,
      FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (winner_id) REFERENCES game_players(id) ON DELETE SET NULL
    )
  `);

  // Game Players table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS game_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      cartela_numbers TEXT NOT NULL,
      entry_fee REAL NOT NULL,
      is_winner INTEGER DEFAULT 0,
      registered_at INTEGER DEFAULT 0,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    )
  `);

  // Transactions table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER,
      employee_id INTEGER,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      created_at INTEGER DEFAULT 0,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Game History table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS game_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      total_collected REAL NOT NULL,
      prize_amount REAL NOT NULL,
      admin_profit REAL NOT NULL,
      player_count INTEGER NOT NULL,
      winner_name TEXT,
      winning_cartela TEXT,
      completed_at INTEGER DEFAULT 0,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Cartelas table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS cartelas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      cartela_number INTEGER NOT NULL,
      card_no INTEGER NOT NULL,
      name TEXT NOT NULL,
      pattern TEXT NOT NULL,
      is_hardcoded INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      is_booked INTEGER DEFAULT 0,
      booked_by INTEGER,
      game_id INTEGER,
      created_at INTEGER DEFAULT 0,
      updated_at INTEGER DEFAULT 0,
      FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (booked_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL,
      UNIQUE(employee_id, cartela_number)
    )
  `);

  // Add card_no column to existing cartelas table if it doesn't exist
  try {
    sqlite.exec(`ALTER TABLE cartelas ADD COLUMN card_no INTEGER`);
    console.log("Added card_no column to cartelas table");
  } catch (error) {
    // Column already exists, which is fine
    console.log("card_no column already exists or error:", error.message);
  }

  // Daily Revenue Summary table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS daily_revenue_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      employee_id INTEGER,
      total_admin_revenue REAL DEFAULT 0,
      total_games_played INTEGER DEFAULT 0,
      total_players_registered INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT 0,
      updated_at INTEGER DEFAULT 0,
      FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better performance
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_games_employee_id ON games(employee_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_game_id ON transactions(game_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_employee_id ON transactions(employee_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_game_history_game_id ON game_history(game_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_game_history_employee_id ON game_history(employee_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_cartelas_employee_id ON cartelas(employee_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_cartelas_cartela_number ON cartelas(cartela_number)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_daily_revenue_summary_employee_id ON daily_revenue_summary(employee_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_daily_revenue_summary_date ON daily_revenue_summary(date)`);
}

// Initialize database
createTables();

// Create default admin user if no users exist
async function createDefaultAdmin() {
  const adminCount = sqlite.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number };
  
  if (adminCount.count === 0) {
    const hashedPassword = await import('bcrypt').then(bcrypt => bcrypt.hash('admin123', 10));
    sqlite.prepare(`
      INSERT INTO users (username, password, role, name, balance, created_at)
      VALUES (?, ?, 'admin', 'Administrator', 1000, ?)
    `).run('admin', hashedPassword, Date.now());
    
    console.log('✅ Default admin user created: username=admin, password=admin123');
  }
}

createDefaultAdmin();

export { sqlite, db };
