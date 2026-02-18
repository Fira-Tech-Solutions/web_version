import type { Config } from 'drizzle-kit';

export default {
  dialect: 'sqlite',
  schema: './shared/schema-simple.ts',
  out: './drizzle',
  driver: 'better-sqlite3',
  dbCredentials: {
    url: './db/bingo.db',
  },
} satisfies Config;
