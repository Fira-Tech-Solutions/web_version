import Database from 'better-sqlite3';
import path from 'path';
import { adminDb } from "../../scripts/admin-db";

export interface AdminUser {
  id?: number;
  username: string;
  password: string;
  name: string;
  accountNumber: string;
  adminGeneratedBalance: string; // Balance admin generated (payment × 10)
  employeePaidAmount: string; // Amount employee paid to admin
  totalRechargeFiles: number; // Number of recharge files generated
  totalRechargeAmount: string; // Total amount of recharge files
  createdAt: string;
  shopId?: string;
  isBlocked: boolean;
  role: string; // Add role field
  machineId?: string; // Add machine ID field
}

export interface AdminRechargeFile {
  id?: number;
  username: string;
  accountNumber: string;
  amount: string;
  filename: string;
  createdAt: string;
  shopId?: string;
}

export class AdminStorage {
  // User tracking for admin dashboard
  createAdminUser(user: Omit<AdminUser, 'id' | 'createdAt' | 'totalRechargeFiles' | 'totalRechargeAmount'>): AdminUser {
    const stmt = adminDb.prepare(`
      INSERT INTO admin_users (
        username, password, name, accountNumber, adminGeneratedBalance, 
        employeePaidAmount, totalRechargeFiles, totalRechargeAmount, 
        createdAt, shopId, isBlocked, role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      user.username,
      user.password,
      user.name,
      user.accountNumber,
      user.adminGeneratedBalance,
      user.employeePaidAmount,
      0, // Initial recharge files count
      "0", // Initial recharge amount
      new Date().toISOString(),
      user.shopId || null,
      user.isBlocked ? 1 : 0, // Convert boolean to integer for SQLite
      user.role || 'employee' // Set role as employee by default
    );

    return this.getAdminUserById(result.lastInsertRowid as number)!;
  }

  getAdminUserById(id: number): AdminUser | undefined {
    const stmt = adminDb.prepare('SELECT * FROM admin_users WHERE id = ?');
    const user = stmt.get(id) as any;
    
    if (user) {
      // Map database fields to frontend format
      return {
        ...user,
        machineId: user.machine_id, // Convert machine_id to machineId
        isBlocked: Boolean(user.is_blocked) // Convert is_blocked to isBlocked
      } as AdminUser;
    }
    
    return undefined;
  }

  getAdminUserByUsername(username: string): AdminUser | undefined {
    const stmt = adminDb.prepare('SELECT * FROM admin_users WHERE username = ?');
    return stmt.get(username) as AdminUser | undefined;
  }

  getAllAdminUsers(): AdminUser[] {
    const stmt = adminDb.prepare('SELECT * FROM admin_users ORDER BY createdAt DESC');
    const users = stmt.all() as any[];
    
    // Map database fields to frontend format
    return users.map(user => ({
      ...user,
      machineId: user.machine_id, // Convert machine_id to machineId
      isBlocked: Boolean(user.is_blocked) // Convert is_blocked to isBlocked
    })) as AdminUser[];
  }

  updateAdminUserBalance(username: string, additionalBalance: string, additionalPaid: string): void {
    const stmt = adminDb.prepare(`
      UPDATE admin_users 
      SET adminGeneratedBalance = adminGeneratedBalance + ?,
          employeePaidAmount = employeePaidAmount + ?
      WHERE username = ?
    `);
    stmt.run(additionalBalance, additionalPaid, username);
  }

  // Recharge file tracking
  createRechargeFileRecord(rechargeFile: Omit<AdminRechargeFile, 'id' | 'createdAt'>): AdminRechargeFile {
    const stmt = adminDb.prepare(`
      INSERT INTO admin_recharge_files (
        filename, fileData, signature, employeeId, amount, createdAt, shopId
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      rechargeFile.filename,
      rechargeFile.fileData,
      rechargeFile.signature,
      rechargeFile.employeeId,
      rechargeFile.amount,
      new Date().toISOString(),
      rechargeFile.shopId
    );

    // Update user's recharge tracking
    this.updateUserRechargeStats(rechargeFile.employeeId, rechargeFile.amount);

    return this.getRechargeFileById(result.lastInsertRowid as number)!;
  }

  private updateUserRechargeStats(employeeId: string, amount: string): void {
    const stmt = adminDb.prepare(`
      UPDATE admin_users 
      SET totalRechargeFiles = totalRechargeFiles + 1,
          totalRechargeAmount = totalRechargeAmount + ?
      WHERE id = ?
    `);
    stmt.run(amount, employeeId);
  }

  getRechargeFileById(id: number): AdminRechargeFile | undefined {
    const stmt = adminDb.prepare('SELECT * FROM admin_recharge_files WHERE id = ?');
    return stmt.get(id) as AdminRechargeFile | undefined;
  }

  getAllRechargeFiles(): AdminRechargeFile[] {
    const stmt = adminDb.prepare('SELECT * FROM admin_recharge_files ORDER BY createdAt DESC');
    return stmt.all() as AdminRechargeFile[];
  }

  deleteAdminUser(id: number): boolean {
    const stmt = adminDb.prepare('DELETE FROM admin_users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  deleteAdminUserByUsername(username: string): boolean {
    const stmt = adminDb.prepare('DELETE FROM admin_users WHERE username = ?');
    const result = stmt.run(username);
    return result.changes > 0;
  }

  // Financial reporting
  getTotalAdminBalance(): string {
    const stmt = adminDb.prepare('SELECT SUM(adminGeneratedBalance) as total FROM admin_users');
    const result = stmt.get() as { total: string };
    return result.total || "0";
  }

  getTotalEmployeePaid(): string {
    const stmt = adminDb.prepare('SELECT SUM(employeePaidAmount) as total FROM admin_users');
    const result = stmt.get() as { total: string };
    return result.total || "0";
  }

  getTotalRechargeAmount(): string {
    const stmt = adminDb.prepare('SELECT SUM(totalRechargeAmount) as total FROM admin_users');
    const result = stmt.get() as { total: string };
    return result.total || "0";
  }

  getUserCount(): number {
    const stmt = adminDb.prepare('SELECT COUNT(*) as count FROM admin_users');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  getRechargeFileCount(): number {
    const stmt = adminDb.prepare('SELECT COUNT(*) as count FROM admin_recharge_files');
    const result = stmt.get() as { count: number };
    return result.count;
  }
}

// Initialize tables
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
    isBlocked BOOLEAN DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS admin_recharge_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    accountNumber TEXT NOT NULL,
    amount TEXT NOT NULL,
    filename TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    shopId TEXT
  );
`);

export const adminStorage = new AdminStorage();
