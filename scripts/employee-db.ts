import Database from 'better-sqlite3';
import path from 'path';

// Employee database - in proper db directory
const employeeDbPath = path.join(process.cwd(), 'db', 'bingo.db');
export const employeeDb = new Database(employeeDbPath);

console.log('👥 Employee Database initialized at:', employeeDbPath);
