import { and, asc, gte, eq, sql as sqlTag } from 'drizzle-orm';
import { db } from '../db.js';
import { events } from '../schema.js';
import type { Event } from '../schema.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function getUpcomingEventsForBand(
  bandId: number,
  limit: number = DEFAULT_LIMIT,
): Promise<Event[]> {
  const clamped = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT);
  return db
    .select()
    .from(events)
    .where(and(eq(events.band_id, bandId), gte(events.datetime, sqlTag`now()`)))
    .orderBy(asc(events.datetime))
    .limit(clamped);
}
