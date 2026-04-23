import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import { seedE2E } from '../seedE2E.js';

/**
 * Test-only routes (MUS-71). Mounted by `index.ts` only when `NODE_ENV=test`
 * so the dev server on port 3001 never exposes them.
 *
 * `POST /test/reset` truncates every user-data table in the DB with
 * `RESTART IDENTITY CASCADE` (so serial PKs reset to 1 — Maestro flows can
 * assume the request id won't drift between runs) and reseeds the minimal
 * fixture from `seedE2E.ts`.
 *
 * The list of tables is enumerated rather than discovered from
 * `information_schema` so an accidental new table doesn't get silently wiped
 * — the test harness should fail loudly and force the dev to add the table
 * here intentionally, OR the test was about that table and they remember to
 * touch this list.
 */
const testRoutes = new Hono();

// Order doesn't matter when CASCADE is in play, but listing children before
// parents keeps the intent obvious to readers.
const TRUNCATE_TABLES = [
  'expressions_of_interest',
  'requests',
  'gig_slots',
  'gigs',
  'rehearsals',
  'engineers_live_audio_groups',
  'engineers_recording_studios',
  'promoter_groups_venues',
  'promoters_promoter_groups',
  'live_audio_groups',
  'recording_studios',
  'venues',
  'promoter_groups',
  'user_roles',
  'musician_profiles',
  'band_tracks',
  'band_members',
  'bands',
  'users',
];

testRoutes.post('/reset', async (c) => {
  const tableList = TRUNCATE_TABLES.map((t) => `"${t}"`).join(', ');
  // `TRUNCATE ... RESTART IDENTITY CASCADE` does the lot in one statement and
  // is dramatically faster than per-table DELETEs. Wrapped via `db.execute`
  // so postgres.js sees this as a server-side simple query.
  await db.execute(sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`));
  await seedE2E();
  return c.json({ ok: true });
});

export default testRoutes;
