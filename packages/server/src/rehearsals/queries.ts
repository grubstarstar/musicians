import { and, asc, gte, eq, sql as sqlTag } from 'drizzle-orm';
import { db } from '../db.js';
import { rehearsals } from '../schema.js';
import type { Rehearsal } from '../schema.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function getUpcomingRehearsalsForBand(
  bandId: number,
  limit: number = DEFAULT_LIMIT,
): Promise<Rehearsal[]> {
  const clamped = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT);
  return db
    .select()
    .from(rehearsals)
    .where(and(eq(rehearsals.band_id, bandId), gte(rehearsals.datetime, sqlTag`now()`)))
    .orderBy(asc(rehearsals.datetime))
    .limit(clamped);
}
