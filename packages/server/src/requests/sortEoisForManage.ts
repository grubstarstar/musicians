import type { EoiState } from '../schema.js';

/**
 * Minimal shape required to sort EoIs for the "Manage my requests" screen.
 * Keeps the function usable with any richer row type (via structural typing).
 */
export interface SortableEoi {
  state: EoiState;
  createdAt: Date;
  decidedAt: Date | null;
}

/**
 * Sort order for MUS-55 Manage Requests:
 *   1. All `pending` EoIs first, oldest-first within that bucket (so the
 *      longest-waiting EoI surfaces first for review).
 *   2. All decided EoIs after, most-recently-decided first (so a source user
 *      scanning their history sees recent activity before stale activity).
 *
 * Pure + stable: returns a new array, does not mutate the input.
 */
export function sortEoisForManage<T extends SortableEoi>(eois: T[]): T[] {
  const pending: T[] = [];
  const decided: T[] = [];
  for (const e of eois) {
    if (e.state === 'pending') pending.push(e);
    else decided.push(e);
  }
  pending.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  decided.sort((a, b) => {
    // If decided_at is missing (data anomaly) fall back to createdAt so the
    // order is still deterministic.
    const at = a.decidedAt?.getTime() ?? a.createdAt.getTime();
    const bt = b.decidedAt?.getTime() ?? b.createdAt.getTime();
    return bt - at;
  });
  return [...pending, ...decided];
}
