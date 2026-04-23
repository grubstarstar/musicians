import { eq, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { musicianProfiles } from '../schema.js';

// Shape returned to clients. Camel-cased to match the rest of the tRPC
// surface; the underlying columns are snake_case per the schema convention.
// Kept as a named type so the router can annotate its return type and so
// `UpsertMusicianProfileInput` can refer back to the mutable subset.
export interface MusicianProfileDto {
  userId: number;
  instruments: string[];
  experienceYears: number | null;
  location: string | null;
  bio: string | null;
  availableForSessionWork: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Fields the caller can upsert against their own profile. `userId` is
 * deliberately absent — the mutation always keys off `ctx.user.id` so one
 * user can never write another user's row.
 */
export interface UpsertMusicianProfileInput {
  instruments: string[];
  experienceYears: number | null;
  location: string | null;
  bio: string | null;
  availableForSessionWork: boolean;
}

/**
 * Fetch the musician profile row for the given user, or null if there isn't
 * one yet. Explicit projection so the API contract is independent of any
 * future schema columns (see CLAUDE.md tRPC conventions — never
 * `db.select().from(table)` bare).
 */
export async function getMusicianProfile(
  userId: number,
): Promise<MusicianProfileDto | null> {
  const [row] = await db
    .select({
      userId: musicianProfiles.user_id,
      instruments: musicianProfiles.instruments,
      experienceYears: musicianProfiles.experience_years,
      location: musicianProfiles.location,
      bio: musicianProfiles.bio,
      availableForSessionWork: musicianProfiles.available_for_session_work,
      createdAt: musicianProfiles.created_at,
      updatedAt: musicianProfiles.updated_at,
    })
    .from(musicianProfiles)
    .where(eq(musicianProfiles.user_id, userId))
    .limit(1);
  return row ?? null;
}

/**
 * Upsert the musician profile for the given user. On conflict we overwrite
 * the mutable columns and bump `updated_at` to `now()`; `created_at` is left
 * untouched so the row's first-seen timestamp is preserved. Returns the
 * projected DTO.
 *
 * `userId` is passed in from the tRPC procedure after it's been coerced
 * from the JWT `sub` string — this helper has no opinion on auth.
 */
export async function upsertMusicianProfile(
  userId: number,
  input: UpsertMusicianProfileInput,
): Promise<MusicianProfileDto> {
  const [row] = await db
    .insert(musicianProfiles)
    .values({
      user_id: userId,
      instruments: input.instruments,
      experience_years: input.experienceYears,
      location: input.location,
      bio: input.bio,
      available_for_session_work: input.availableForSessionWork,
    })
    .onConflictDoUpdate({
      target: musicianProfiles.user_id,
      set: {
        instruments: input.instruments,
        experience_years: input.experienceYears,
        location: input.location,
        bio: input.bio,
        available_for_session_work: input.availableForSessionWork,
        updated_at: sql`now()`,
      },
    })
    .returning({
      userId: musicianProfiles.user_id,
      instruments: musicianProfiles.instruments,
      experienceYears: musicianProfiles.experience_years,
      location: musicianProfiles.location,
      bio: musicianProfiles.bio,
      availableForSessionWork: musicianProfiles.available_for_session_work,
      createdAt: musicianProfiles.created_at,
      updatedAt: musicianProfiles.updated_at,
    });
  // `returning(...)` on a conflict-resolving insert always produces exactly
  // one row, but the tuple-destructuring typings don't know that.
  if (!row) {
    throw new Error('upsertMusicianProfile: returning() produced no row');
  }
  return row;
}
