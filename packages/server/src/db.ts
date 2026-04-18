import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/musicians';

export const sql = postgres(connectionString);
export const db = drizzle(sql, { schema });

export type { User, Band, BandMember, BandTrack, BandWithMembers, BandProfile } from './schema.js';
