/**
 * Air-Gapped License Database (SQLite)
 * Portable DB for activation state and used recharge tokens.
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "license.db");

let db: Database.Database | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getLicenseDb(): Database.Database {
  if (!db) {
    ensureDataDir();
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initTables(db);
  }
  return db;
}

function initTables(database: Database.Database) {
  database.exec(`
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
  `);
}

export interface ActivationRow {
  machine_id: string;
  activated_at: string;
}

export function isActivated(): boolean {
  const database = getLicenseDb();
  const row = database.prepare("SELECT machine_id FROM activation WHERE id = 1").get();
  return !!row;
}

export function getActivation(): ActivationRow | null {
  const database = getLicenseDb();
  const row = database.prepare("SELECT machine_id, activated_at FROM activation WHERE id = 1").get() as ActivationRow | undefined;
  return row || null;
}

export function setActivation(machineId: string): void {
  const database = getLicenseDb();
  database.prepare(
    "INSERT OR REPLACE INTO activation (id, machine_id, activated_at) VALUES (1, ?, datetime('now'))"
  ).run(machineId);
}

export function isTokenUsed(transactionId: string): boolean {
  const database = getLicenseDb();
  const row = database.prepare("SELECT 1 FROM used_tokens WHERE transaction_id = ?").get(transactionId);
  return !!row;
}

export function recordToken(transactionId: string, amount: number, employeeId?: number): void {
  const database = getLicenseDb();
  database.transaction(() => {
    database.prepare(
      "INSERT INTO used_tokens (transaction_id, amount, employee_id, redeemed_at) VALUES (?, ?, ?, datetime('now'))"
    ).run(transactionId, amount, employeeId ?? null);
    database.prepare(
      "INSERT INTO recharge_log (transaction_id, amount, employee_id, redeemed_at) VALUES (?, ?, ?, datetime('now'))"
    ).run(transactionId, amount, employeeId ?? null);
  })();
}

export function getTotalRecharged(employeeId?: number): number {
  const database = getLicenseDb();
  let row: { total: number } | undefined;
  if (employeeId != null) {
    row = database.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM recharge_log WHERE employee_id = ?"
    ).get(employeeId) as { total: number } | undefined;
  } else {
    row = database.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM recharge_log"
    ).get() as { total: number } | undefined;
  }
  return row?.total ?? 0;
}
