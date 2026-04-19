import { describe, expect, it } from 'vitest';
import { sortEoisForManage, type SortableEoi } from './sortEoisForManage.js';

function eoi(overrides: Partial<SortableEoi> & { id?: number }): SortableEoi & { id: number } {
  return {
    id: overrides.id ?? 0,
    state: overrides.state ?? 'pending',
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00Z'),
    decidedAt: overrides.decidedAt ?? null,
  };
}

describe('sortEoisForManage', () => {
  it('returns an empty array when given no EoIs', () => {
    expect(sortEoisForManage([])).toEqual([]);
  });

  it('puts pending EoIs before decided EoIs', () => {
    const result = sortEoisForManage([
      eoi({ id: 1, state: 'accepted', decidedAt: new Date('2026-03-01T00:00:00Z') }),
      eoi({ id: 2, state: 'pending' }),
    ]);
    expect(result.map((e) => e.id)).toEqual([2, 1]);
  });

  it('orders pending EoIs oldest-first', () => {
    const result = sortEoisForManage([
      eoi({ id: 1, state: 'pending', createdAt: new Date('2026-03-05') }),
      eoi({ id: 2, state: 'pending', createdAt: new Date('2026-03-01') }),
      eoi({ id: 3, state: 'pending', createdAt: new Date('2026-03-03') }),
    ]);
    expect(result.map((e) => e.id)).toEqual([2, 3, 1]);
  });

  it('orders decided EoIs most-recently-decided first', () => {
    const result = sortEoisForManage([
      eoi({
        id: 1,
        state: 'accepted',
        decidedAt: new Date('2026-03-01T12:00:00Z'),
      }),
      eoi({
        id: 2,
        state: 'rejected',
        decidedAt: new Date('2026-03-05T12:00:00Z'),
      }),
      eoi({
        id: 3,
        state: 'auto_rejected',
        decidedAt: new Date('2026-03-03T12:00:00Z'),
      }),
    ]);
    expect(result.map((e) => e.id)).toEqual([2, 3, 1]);
  });

  it('falls back to createdAt when decidedAt is missing', () => {
    // Defensive: shouldn't happen with a well-formed DB row, but make sure
    // the sort stays deterministic rather than relying on Array.sort's
    // stability (which V8 guarantees but older engines do not).
    const result = sortEoisForManage([
      eoi({
        id: 1,
        state: 'rejected',
        decidedAt: null,
        createdAt: new Date('2026-01-01'),
      }),
      eoi({
        id: 2,
        state: 'rejected',
        decidedAt: null,
        createdAt: new Date('2026-02-01'),
      }),
    ]);
    expect(result.map((e) => e.id)).toEqual([2, 1]);
  });

  it('interleaves correctly with a mix of pending and decided', () => {
    const result = sortEoisForManage([
      eoi({
        id: 1,
        state: 'accepted',
        decidedAt: new Date('2026-03-01'),
      }),
      eoi({ id: 2, state: 'pending', createdAt: new Date('2026-02-15') }),
      eoi({
        id: 3,
        state: 'rejected',
        decidedAt: new Date('2026-03-10'),
      }),
      eoi({ id: 4, state: 'pending', createdAt: new Date('2026-02-10') }),
    ]);
    // Pending oldest-first: 4, 2. Then decided newest-decided-first: 3, 1.
    expect(result.map((e) => e.id)).toEqual([4, 2, 3, 1]);
  });

  it('does not mutate the input array', () => {
    const input = [
      eoi({ id: 1, state: 'accepted', decidedAt: new Date('2026-03-01') }),
      eoi({ id: 2, state: 'pending' }),
    ];
    const snapshot = input.map((e) => e.id);
    sortEoisForManage(input);
    expect(input.map((e) => e.id)).toEqual(snapshot);
  });
});
