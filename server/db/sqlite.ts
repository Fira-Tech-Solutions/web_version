import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema-simple";

// Initialize SQLite database
const sqlite = new Database('bingo.db');
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
      shop_id INTEGER,
      credit_balance REAL DEFAULT 0,
      referred_by INTEGER,
      commission_rate REAL DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL
    )
  `);

  // Shops table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      admin_id INTEGER NOT NULL,
      profit_margin REAL DEFAULT 20,
      balance REAL DEFAULT 0,
      is_blocked INTEGER DEFAULT 0,
      total_revenue REAL DEFAULT 0,
      total_games INTEGER DEFAULT 0,
      total_players INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Games table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      prize_pool REAL DEFAULT 0,
      entry_fee REAL NOT NULL,
      called_numbers TEXT DEFAULT '[]',
      winner_id INTEGER,
      started_at INTEGER,
      completed_at INTEGER,
      is_paused INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
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
      registered_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    )
  `);

  // Transactions table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER,
      shop_id INTEGER,
      employee_id INTEGER,
      admin_id INTEGER,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Game History table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS game_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      shop_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      total_collected REAL NOT NULL,
      prize_amount REAL NOT NULL,
      admin_profit REAL NOT NULL,
      player_count INTEGER NOT NULL,
      winner_name TEXT,
      winning_cartela TEXT,
      completed_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Cartelas table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS cartelas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      admin_id INTEGER NOT NULL,
      cartela_number INTEGER NOT NULL,
      name TEXT NOT NULL,
      pattern TEXT NOT NULL,
      is_hardcoded INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      is_booked INTEGER DEFAULT 0,
      booked_by INTEGER,
      game_id INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      UNIQUE(shop_id, cartela_number),
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (booked_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
    )
  `);

  // Daily Revenue Summary table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS daily_revenue_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      total_admin_revenue REAL DEFAULT 0,
      total_games_played INTEGER DEFAULT 0,
      total_players_registered INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Create indexes for better performance
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_users_shop_id ON users(shop_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_games_shop_id ON games(shop_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_games_employee_id ON games(employee_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_shop_id ON transactions(shop_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_employee_id ON transactions(employee_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_game_history_shop_id ON game_history(shop_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_game_history_employee_id ON game_history(employee_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_cartelas_shop_id ON cartelas(shop_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_cartelas_is_booked ON cartelas(is_booked)`);

  // Create SQLite View for Admin balance calculation
  sqlite.exec(`
    CREATE VIEW IF NOT EXISTS admin_balances AS
    SELECT 
      s.id as shop_id,
      s.admin_id,
      s.name as shop_name,
      s.balance as shop_balance,
      COALESCE(SUM(u.balance), 0) as total_employee_balance,
      (s.balance + COALESCE(SUM(u.balance), 0)) as master_float
    FROM shops s
    LEFT JOIN users u ON s.id = u.shop_id AND u.role = 'employee'
    GROUP BY s.id, s.admin_id, s.name, s.balance
  `);

  // Insert default admin if none exists
  const adminCount = sqlite.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin') as { count: number };
  if (adminCount.count === 0) {
    const defaultAdmin = {
      username: 'admin',
      password: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 'password'
      role: 'admin',
      name: 'Default Admin',
      email: 'admin@bingo.local',
      account_number: 'BGO000001',
      balance: 1000,
      is_blocked: 0,
      credit_balance: 1000,
      commission_rate: 0
    };

    const adminResult = sqlite.prepare(`
      INSERT INTO users (username, password, role, name, email, account_number, balance, is_blocked, credit_balance, commission_rate)
      VALUES (@username, @password, @role, @name, @email, @account_number, @balance, @is_blocked, @credit_balance, @commission_rate)
    `).run(defaultAdmin);

    const adminId = adminResult.lastInsertRowid as number;

    // Create default shop for admin
    const defaultShop = {
      name: 'Default Shop',
      admin_id: adminId,
      profit_margin: 20,
      balance: 1000,
      is_blocked: 0,
      total_revenue: 0,
      total_games: 0,
      total_players: 0
    };

    sqlite.prepare(`
      INSERT INTO shops (name, admin_id, profit_margin, balance, is_blocked, total_revenue, total_games, total_players)
      VALUES (@name, @admin_id, @profit_margin, @balance, @is_blocked, @total_revenue, @total_games, @total_players)
    `).run(defaultShop);

    // Update admin to have the shop
    sqlite.prepare('UPDATE users SET shop_id = ? WHERE id = ?').run(defaultShop.admin_id, adminId);

    // Create default employee
    const defaultEmployee = {
      username: 'employee',
      password: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 'password'
      role: 'employee',
      name: 'Default Employee',
      email: 'employee@bingo.local',
      account_number: 'EMP000001',
      balance: 0,
      is_blocked: 0,
      shop_id: adminId,
      credit_balance: 0,
      commission_rate: 0
    };

    sqlite.prepare(`
      INSERT INTO users (username, password, role, name, email, account_number, balance, is_blocked, shop_id, credit_balance, commission_rate)
      VALUES (@username, @password, @role, @name, @email, @account_number, @balance, @is_blocked, @shop_id, @credit_balance, @commission_rate)
    `).run(defaultEmployee);
  }
}

// Initialize database
createTables();

export { sqlite, db };