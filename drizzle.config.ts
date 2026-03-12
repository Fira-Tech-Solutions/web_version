import type { Config } from 'drizzle-kit';

export default {
  dialect: 'postgresql',
  schema: './shared/schema-postgres.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/test_bingo',
  },
} satisfies Config;
