// MUS-68: read-side DB helpers for the `instruments` taxonomy.
//
// Kept in its own file (not the existing `requests/queries.ts`) because the
// taxonomy is its own concern — the autocomplete and "Other" fallback logic
// read from these helpers but the two can evolve independently of the
// request discovery queries.

import { asc, ilike, or, sql as sqlTag } from 'drizzle-orm';
import { db } from '../db.js';
import { instruments, type Instrument } from '../schema.js';
import { rankInstrumentSearch } from './rankInstrumentSearch.js';

export interface InstrumentRow {
  id: number;
  name: string;
  category: string | null;
}

/** Full list of the taxonomy, sorted by name. 150–200 rows — one query. */
export async function listInstruments(): Promise<InstrumentRow[]> {
  return db
    .select({
      id: instruments.id,
      name: instruments.name,
      category: instruments.category,
    })
    .from(instruments)
    .orderBy(asc(instruments.name));
}

/**
 * Autocomplete lookup. Performs an ILIKE-based search that captures both
 * prefix and contains matches, then sorts/limits in memory via the pure
 * `rankInstrumentSearch` helper so ranking rules can be unit-tested without
 * a DB.
 *
 * Trimmed empty queries return the first 20 rows (alphabetical) so the
 * mobile input can show a starter list before the caller types.
 */
export async function searchInstruments(query: string): Promise<InstrumentRow[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return db
      .select({
        id: instruments.id,
        name: instruments.name,
        category: instruments.category,
      })
      .from(instruments)
      .orderBy(asc(instruments.name))
      .limit(20);
  }

  // `sqlTag` builds a value-parameterised LIKE pattern; Drizzle escapes the
  // user-supplied string. Rows are de-duped to a single per-id entry by the
  // OR (Postgres does this naturally), so we just fetch and then rank.
  const prefixPattern = `${trimmed}%`;
  const containsPattern = `%${trimmed}%`;

  const rows = await db
    .select({
      id: instruments.id,
      name: instruments.name,
      category: instruments.category,
    })
    .from(instruments)
    .where(
      or(
        ilike(instruments.name, prefixPattern),
        ilike(instruments.name, containsPattern),
      ),
    )
    .limit(100);

  return rankInstrumentSearch(rows, trimmed).slice(0, 20);
}

/**
 * Returns the canonical "Other" row id (the fallback bucket for free-text
 * inputs the client can't resolve against the taxonomy). Throws if missing
 * — seed is the source of truth and its absence is a deployment bug.
 */
export async function getOtherInstrumentId(): Promise<number> {
  const [row] = await db
    .select({ id: instruments.id })
    .from(instruments)
    .where(sqlTag`${instruments.name} = 'Other'`)
    .limit(1);
  if (!row) {
    throw new Error('Instruments seed missing "Other" row; cannot resolve free-text fallback.');
  }
  return row.id;
}

export type { Instrument };
