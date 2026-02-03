
import pg from 'pg';
import "dotenv/config";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function resetDb() {
    const client = await pool.connect();
    try {
        console.log("Dropping public schema...");
        await client.query('DROP SCHEMA IF EXISTS public CASCADE');
        console.log("Recreating public schema...");
        await client.query('CREATE SCHEMA public');
        console.log("Granting permissions...");
        await client.query('GRANT ALL ON SCHEMA public TO public');
        // We might need to grant to specific user if DATABASE_URL has a user, 
        // but usually 'public' is enough for the owner or standard usage in this context.
        // If the user in DATABASE_URL is not the owner, they might lose access if we don't grant back.
        // However, usually the user *is* the owner or has enough privileges.

        console.log("Database reset complete.");
    } catch (err) {
        console.error("Error resetting database:", err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

resetDb();
