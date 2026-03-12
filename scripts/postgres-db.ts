import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/test_bingo',
});

export const db = drizzle(pool);

console.log('🐘 PostgreSQL Database initialized');
