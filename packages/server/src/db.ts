import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as schema from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath =
  process.env.MUSICIANS_DB_PATH ??
  join(__dirname, '..', '..', '..', 'musicians.db');

export const sqlite = new Database(dbPath);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  )
`);

// Add new columns to users if they don't exist yet
for (const col of ['firstName TEXT', 'lastName TEXT']) {
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch { /* already exists */ }
}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS bands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS band_members (
    band_id INTEGER NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (band_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS band_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    band_id INTEGER NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  );
`);

try { sqlite.exec('ALTER TABLE bands ADD COLUMN imageUrl TEXT'); } catch { /* already exists */ }

export const db = drizzle(sqlite, { schema });

export type { User, Band, BandMember, BandTrack, BandWithMembers, BandProfile } from './schema.js';
