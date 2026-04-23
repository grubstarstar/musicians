// Denormalisation helper for MUS-68.
//
// The `requests.details` JSONB column stores `instrumentId` only (the
// single source of truth is the `instruments` taxonomy). Several read
// endpoints need to surface the instrument name alongside for display —
// the mobile list rows, request detail screen, and Applied cards all
// render the name. Rather than forcing the client to run N instrument
// lookups, the server joins `instruments` at query time and this helper
// patches the resolved name into `details` before sending.
//
// Kept pure (no DB, no side effects) so it's easy to unit-test and so the
// list queries can batch a single `instruments` lookup and call this per
// row.

import type { RequestDetails } from '../schema.js';

export type RequestDetailsWithInstrumentName =
  | (Extract<RequestDetails, { kind: 'musician-for-band' }> & {
      instrumentName: string | null;
    })
  | (Extract<RequestDetails, { kind: 'band-for-musician' }> & {
      instrumentName: string | null;
    })
  | Exclude<
      RequestDetails,
      { kind: 'musician-for-band' } | { kind: 'band-for-musician' }
    >;

/**
 * Returns a new `details` object with `instrumentName` filled in for the two
 * kinds that carry `instrumentId`. Other kinds pass through unchanged.
 * `instrumentName` is `null` when the lookup map has no entry for the id —
 * callers should treat that as an unresolved id (e.g. the "Other" row was
 * deleted in between the read and the lookup) and render a safe fallback.
 */
export function withInstrumentName(
  details: RequestDetails,
  instrumentNameById: ReadonlyMap<number, string>,
): RequestDetailsWithInstrumentName {
  if (details.kind === 'musician-for-band') {
    return {
      ...details,
      instrumentName: instrumentNameById.get(details.instrumentId) ?? null,
    };
  }
  if (details.kind === 'band-for-musician') {
    return {
      ...details,
      instrumentName: instrumentNameById.get(details.instrumentId) ?? null,
    };
  }
  return details;
}

/** Collects every instrumentId referenced by a list of `details` objects. */
export function collectInstrumentIds(detailsList: RequestDetails[]): number[] {
  const set = new Set<number>();
  for (const d of detailsList) {
    if (d.kind === 'musician-for-band' || d.kind === 'band-for-musician') {
      set.add(d.instrumentId);
    }
  }
  return Array.from(set);
}
