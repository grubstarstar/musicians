// Pure input-shaping helpers for the Session-musician profile screen (MUS-93).
//
// Kept in `src/utils/` so vitest can exercise them without pulling the
// React Native / Expo Router module graph in (see `packages/mobile/vitest.config.ts`).
//
// The helpers sit between the screen's string-y form state and the tRPC
// `musicianProfiles.upsertMine` input. The router's Zod schema (see
// `packages/server/src/trpc/router.ts`) demands:
//   - `instruments`: string[] where each entry has min length 1
//   - `experienceYears`: int >= 0 or null (no empty-string)
//   - `location`: non-empty string or null
//   - `bio`: non-empty string or null
//   - `availableForSessionWork`: boolean
//
// Empty / whitespace-only text fields therefore become `null`, not `""`, and
// an unparseable experience years becomes a validation error rather than a
// silent `NaN` round-trip.

export interface SessionMusicianProfileInput {
  instruments: string[];
  experienceYears: number | null;
  location: string | null;
  bio: string | null;
  availableForSessionWork: boolean;
}

export type SessionMusicianValidationError =
  | 'no-instruments'
  | 'experience-years-invalid';

export interface BuildSessionMusicianProfileArgs {
  instruments: string[];
  experienceYears: string;
  location: string;
  bio: string;
  availableForSessionWork: boolean;
}

export type BuildSessionMusicianProfileResult =
  | { ok: true; input: SessionMusicianProfileInput }
  | { ok: false; error: SessionMusicianValidationError };

/**
 * Normalise a free-text chip-entry buffer into the canonical instruments list.
 *
 * Trims whitespace, drops empty entries, and de-duplicates while preserving
 * the first-seen order (so the UI's chip order is stable).
 */
export function normaliseInstruments(instruments: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of instruments) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Turn a free-text "years" input into a non-negative integer, or report that
 * the input was provided but unparseable. An empty/whitespace-only string is
 * treated as "not provided" (returns null).
 *
 * We deliberately reject negatives, fractions, and non-numeric text rather
 * than silently coercing — the Zod schema would bounce them, and we want the
 * form to surface the problem inline before a round-trip.
 */
export function parseExperienceYears(
  raw: string,
): { ok: true; value: number | null } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  // Integer-only: reject '3.5', '3e2', leading '+', etc. The form uses
  // `keyboardType="number-pad"`, but users can still paste.
  if (!/^\d+$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return { ok: false };
  return { ok: true, value };
}

/**
 * Convenience: empty/whitespace-only optional text fields map to `null`
 * (not `""`). The server's Zod schema refuses empty strings for these
 * columns, so we collapse here rather than push the rule to the call site.
 */
function nullIfBlank(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Build the full upsert payload. Returns a discriminated result so the
 * caller can render a specific inline error for the distinct failure modes
 * (no instruments, bad years input) rather than relying on server Zod
 * messages that arrive after a network round-trip.
 */
export function buildSessionMusicianProfileInput(
  args: BuildSessionMusicianProfileArgs,
): BuildSessionMusicianProfileResult {
  const instruments = normaliseInstruments(args.instruments);
  if (instruments.length === 0) {
    return { ok: false, error: 'no-instruments' };
  }
  const years = parseExperienceYears(args.experienceYears);
  if (!years.ok) {
    return { ok: false, error: 'experience-years-invalid' };
  }
  return {
    ok: true,
    input: {
      instruments,
      experienceYears: years.value,
      location: nullIfBlank(args.location),
      bio: nullIfBlank(args.bio),
      availableForSessionWork: args.availableForSessionWork,
    },
  };
}
