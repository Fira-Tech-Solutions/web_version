#!/usr/bin/env node

/**
 * Database Reset Script
 * Wipes all data and creates only admin user with all tables
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://7494ef1e6e1659bc4b1f951242b1733f0058d762b51259b7ae17d92ea4a2bb30:sk_W0TddwplDabfmO8HvglXo@db.prisma.io:5432/postgres?sslmode=require',
});

const db = drizzle(pool);

async function resetDatabase() {
  console.log('🔄 Starting database reset...');
  
  try {
    // Get all table names
    const result = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    
    const tables = result.rows.map(row => row.tablename);
    console.log('📋 Found tables:', tables);
    
    // Drop all tables in correct order (handle foreign key constraints)
    const dropOrder = [
      'game_history',
      'daily_revenue_summary', 
      'used_recharges',
      'recharge_files',
      'cartelas',
      'game_players',
      'games',
      'transactions',
      'users'
    ];
    
    // Drop tables in dependency order
    for (const tableName of dropOrder) {
      if (tables.includes(tableName)) {
        console.log(`🗑️  Dropping table: ${tableName}`);
        await pool.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
      }
    }
    
    // Drop any remaining tables
    for (const tableName of tables) {
      if (!dropOrder.includes(tableName)) {
        console.log(`🗑️  Dropping remaining table: ${tableName}`);
        await pool.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
      }
    }
    
    console.log('✅ All tables dropped successfully');
    
    // Run migrations to recreate tables
    console.log('🏗️  Running migrations...');
    const migrationPath = path.join(process.cwd(), 'drizzle');
    
    // Check if migrations directory exists
    if (fs.existsSync(migrationPath)) {
      await migrate(db, { migrationsFolder: migrationPath });
      console.log('✅ Migrations completed');
    } else {
      console.log('⚠️  No migrations directory found, creating tables manually...');
      
      // Create tables manually based on schema
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "users" (
          "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "username" text NOT NULL UNIQUE,
          "password" text NOT NULL,
          "role" text NOT NULL DEFAULT 'employee',
          "name" text NOT NULL,
          "email" text,
          "account_number" text UNIQUE,
          "balance" real DEFAULT 0,
          "is_blocked" boolean DEFAULT false,
          "credit_balance" real DEFAULT 0,
          "total_revenue" real DEFAULT 0,
          "total_games" integer DEFAULT 0,
          "total_players" integer DEFAULT 0,
          "machine_id" text,
          "created_at" timestamp DEFAULT now(),
          "admin_generated_balance" text DEFAULT "0",
          "employee_paid_amount" text DEFAULT "0",
          "total_recharge_files" integer DEFAULT 0,
          "total_recharge_amount" text DEFAULT "0",
          "shop_id" text
        );
        
        CREATE TABLE IF NOT EXISTS "games" (
          "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "employee_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "status" text NOT NULL,
          "prize_pool" real DEFAULT 0,
          "entry_fee" real NOT NULL,
          "called_numbers" text DEFAULT '[]',
          "winner_id" integer REFERENCES "game_players"("id") ON DELETE SET NULL,
          "started_at" timestamp,
          "completed_at" timestamp,
          "is_paused" boolean DEFAULT false,
          "created_at" timestamp DEFAULT now()
        );
        
        CREATE TABLE IF NOT EXISTS "game_players" (
          "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "game_id" integer NOT NULL REFERENCES "games"("id") ON DELETE CASCADE,
          "player_name" text NOT NULL,
          "cartela_numbers" text NOT NULL,
          "entry_fee" real NOT NULL,
          "is_winner" boolean DEFAULT false,
          "registered_at" timestamp DEFAULT now()
        );
        
        CREATE TABLE IF NOT EXISTS "transactions" (
          "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "amount" text NOT NULL,
          "type" text NOT NULL,
          "description" text,
          "created_at" timestamp DEFAULT now()
        );
        
        CREATE TABLE IF NOT EXISTS "cartelas" (
          "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "game_id" integer NOT NULL REFERENCES "games"("id") ON DELETE CASCADE,
          "player_name" text NOT NULL,
          "numbers" text NOT NULL,
          "marked" text DEFAULT '[]',
          "created_at" timestamp DEFAULT now()
        );
        
        CREATE TABLE IF NOT EXISTS "recharge_files" (
          "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "nonce" text NOT NULL UNIQUE,
          "signature" text NOT NULL,
          "amount" real NOT NULL,
          "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
          "machine_id" text,
          "created_at" timestamp DEFAULT now()
        );
        
        CREATE TABLE IF NOT EXISTS "used_recharges" (
          "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "nonce" text NOT NULL UNIQUE,
          "signature" text NOT NULL,
          "amount" real NOT NULL,
          "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "machine_id" text,
          "created_at" timestamp DEFAULT now()
        );
        
        CREATE TABLE IF NOT EXISTS "game_history" (
          "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "game_id" integer NOT NULL REFERENCES "games"("id") ON DELETE CASCADE,
          "employee_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "action" text NOT NULL,
          "data" text,
          "created_at" timestamp DEFAULT now()
        );
        
        CREATE TABLE IF NOT EXISTS "daily_revenue_summary" (
          "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          "employee_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "date" text NOT NULL,
          "total_games" integer DEFAULT 0,
          "total_players" integer DEFAULT 0,
          "total_revenue" real DEFAULT 0,
          "total_winnings" real DEFAULT 0,
          "created_at" timestamp DEFAULT now()
        );
      `);
      
      console.log('✅ Tables created manually');
    }
    
    // Create admin user
    console.log('👤 Creating admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await pool.query(`
      INSERT INTO "users" (username, password, role, name, email, balance)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (username) DO NOTHING
    `, [
      'admin',
      hashedPassword,
      'admin',
      'Administrator',
      'admin@bingo.com',
      0
    ]);
    
    console.log('✅ Admin user created successfully');
    console.log('📋 Admin credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   Role: admin');
    
    // Verify admin user was created
    const adminCheck = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    if (adminCheck.rows.length > 0) {
      console.log('✅ Admin user verified in database');
    } else {
      console.log('❌ Admin user not found in database');
    }
    
    console.log('🎉 Database reset completed successfully!');
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the reset
resetDatabase().catch(console.error);
