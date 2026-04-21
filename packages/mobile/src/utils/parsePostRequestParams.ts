// Pure helpers for parsing the Post Request screen's route params.
//
// MUS-70 introduces in-context entry points (e.g. band page, gig page) that
// deep-link into `/post-request?kind=...&bandId=...` with pre-filled state.
// Keeping the param-parsing logic pure (no expo-router imports) lets it live
// under `src/utils/` where vitest already picks up test files.

export type SeedRequestKind =
  | 'musician-for-band'
  | 'band-for-gig-slot'
  | 'gig-for-band'
  | 'night-at-venue'
  | 'promoter-for-venue-night'
  | 'band-for-musician';

/**
 * A validated seed derived from route params. Each field is populated only
 * when the corresponding param was present AND well-formed. Callers should
 * apply each field conditionally — a bad param is treated as "not supplied"
 * rather than surfacing an error, matching the ticket's "bad params = blank
 * form" rule.
 */
export interface PostRequestSeed {
  kind: SeedRequestKind | null;
  bandId: number | null;
  gigId: number | null;
  /**
   * Genre param passed through from the gig-detail entry point. The
   * `band-for-gig-slot` form has no genre field today (MUS-70 flags this as
   * a future hook), so this is parsed and kept on the seed for later use /
   * deep-link accuracy, but currently has no render target.
   */
  genre: string | null;
}

const VALID_KINDS: ReadonlySet<SeedRequestKind> = new Set<SeedRequestKind>([
  'musician-for-band',
  'band-for-gig-slot',
  'gig-for-band',
  'night-at-venue',
  'promoter-for-venue-night',
  'band-for-musician',
]);

/**
 * Expo Router's `useLocalSearchParams` returns each value as
 * `string | string[] | undefined`. Narrow to a single string (taking the
 * first element of an array so repeated keys degrade gracefully) or `null`
 * when absent/empty.
 */
function firstString(value: string | string[] | undefined): string | null {
  if (value === undefined) return null;
  const s = Array.isArray(value) ? value[0] : value;
  if (typeof s !== 'string') return null;
  const trimmed = s.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Parses a raw `Record<string, string | string[] | undefined>` params bag
 * into a validated `PostRequestSeed`. Unknown / malformed values are coerced
 * to `null` so the caller can treat "invalid or missing" as a single case.
 *
 * Accepts a loosely-typed bag because that's what `useLocalSearchParams`
 * returns; returning a strict typed shape keeps the seeding call-site
 * simple.
 */
export function parsePostRequestParams(
  raw: Record<string, string | string[] | undefined>,
): PostRequestSeed {
  const kindStr = firstString(raw.kind);
  const kind =
    kindStr !== null && VALID_KINDS.has(kindStr as SeedRequestKind)
      ? (kindStr as SeedRequestKind)
      : null;

  const bandId = parsePositiveInt(firstString(raw.bandId));
  const gigId = parsePositiveInt(firstString(raw.gigId));
  const genre = firstString(raw.genre);

  return { kind, bandId, gigId, genre };
}

function parsePositiveInt(s: string | null): number | null {
  if (s === null) return null;
  // Guard against strings like "12abc" which Number() would accept as NaN but
  // parseInt accepts partially. We want strict numerics only.
  if (!/^\d+$/.test(s)) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
