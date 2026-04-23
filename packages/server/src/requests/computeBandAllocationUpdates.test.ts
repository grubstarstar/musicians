import { describe, expect, it } from 'vitest';
import { computeBandAllocationUpdates } from './computeBandAllocationUpdates.js';

// MUS-68: updated to assert id-equality semantics. The previous
// string-normalisation behaviour is gone — ids come from the `instruments`
// taxonomy so there's no normalisation to do.

describe('computeBandAllocationUpdates', () => {
  it('returns an empty list when there are no siblings', () => {
    expect(computeBandAllocationUpdates([], 10)).toEqual([]);
  });

  it('returns an empty list when the joining instrumentId is non-positive', () => {
    expect(
      computeBandAllocationUpdates(
        [
          {
            id: 1,
            slotsFilled: 0,
            slotCount: 1,
            instrumentId: 10,
            pendingEoiIds: [],
          },
        ],
        0,
      ),
    ).toEqual([]);
  });

  it('auto-closes a single-slot matching sibling', () => {
    expect(
      computeBandAllocationUpdates(
        [
          {
            id: 1,
            slotsFilled: 0,
            slotCount: 1,
            instrumentId: 10,
            pendingEoiIds: [],
          },
        ],
        10,
      ),
    ).toEqual([
      { id: 1, newSlotsFilled: 1, shouldClose: true, eoiIdsToAutoReject: [] },
    ]);
  });

  it('keeps a multi-slot matching sibling open if slots remain', () => {
    expect(
      computeBandAllocationUpdates(
        [
          {
            id: 7,
            slotsFilled: 1,
            slotCount: 3,
            instrumentId: 10,
            pendingEoiIds: [],
          },
        ],
        10,
      ),
    ).toEqual([
      { id: 7, newSlotsFilled: 2, shouldClose: false, eoiIdsToAutoReject: [] },
    ]);
  });

  it('auto-rejects every pending EoI on a sibling that closes', () => {
    expect(
      computeBandAllocationUpdates(
        [
          {
            id: 10,
            slotsFilled: 0,
            slotCount: 1,
            instrumentId: 10,
            pendingEoiIds: [101, 102, 103],
          },
        ],
        10,
      ),
    ).toEqual([
      {
        id: 10,
        newSlotsFilled: 1,
        shouldClose: true,
        eoiIdsToAutoReject: [101, 102, 103],
      },
    ]);
  });

  it('does not auto-reject pending EoIs on a sibling that stays open', () => {
    expect(
      computeBandAllocationUpdates(
        [
          {
            id: 11,
            slotsFilled: 1,
            slotCount: 5,
            instrumentId: 10,
            pendingEoiIds: [201, 202],
          },
        ],
        10,
      ),
    ).toEqual([
      { id: 11, newSlotsFilled: 2, shouldClose: false, eoiIdsToAutoReject: [] },
    ]);
  });

  it('omits siblings whose instrumentId does not match', () => {
    // A drummer joining does not affect the band's open bass-player search.
    expect(
      computeBandAllocationUpdates(
        [
          {
            id: 1,
            slotsFilled: 0,
            slotCount: 1,
            instrumentId: 10,
            pendingEoiIds: [901],
          },
          {
            id: 2,
            slotsFilled: 0,
            slotCount: 1,
            instrumentId: 11,
            pendingEoiIds: [902],
          },
        ],
        12,
      ),
    ).toEqual([]);
  });

  it('handles multiple siblings with mixed instruments — only matching ones update', () => {
    expect(
      computeBandAllocationUpdates(
        [
          // Matching — will close, auto-reject 901
          {
            id: 1,
            slotsFilled: 0,
            slotCount: 1,
            instrumentId: 10,
            pendingEoiIds: [901],
          },
          // Non-matching — untouched
          {
            id: 2,
            slotsFilled: 0,
            slotCount: 2,
            instrumentId: 11,
            pendingEoiIds: [902, 903],
          },
          // Matching — stays open
          {
            id: 3,
            slotsFilled: 0,
            slotCount: 3,
            instrumentId: 10,
            pendingEoiIds: [904],
          },
        ],
        10,
      ),
    ).toEqual([
      { id: 1, newSlotsFilled: 1, shouldClose: true, eoiIdsToAutoReject: [901] },
      { id: 3, newSlotsFilled: 1, shouldClose: false, eoiIdsToAutoReject: [] },
    ]);
  });

  it('skips siblings with non-positive instrumentId (defensive)', () => {
    expect(
      computeBandAllocationUpdates(
        [
          {
            id: 1,
            slotsFilled: 0,
            slotCount: 1,
            instrumentId: 0,
            pendingEoiIds: [],
          },
        ],
        0,
      ),
    ).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const siblings = [
      {
        id: 1,
        slotsFilled: 0,
        slotCount: 2,
        instrumentId: 10,
        pendingEoiIds: [42],
      },
    ];
    computeBandAllocationUpdates(siblings, 10);
    expect(siblings).toEqual([
      {
        id: 1,
        slotsFilled: 0,
        slotCount: 2,
        instrumentId: 10,
        pendingEoiIds: [42],
      },
    ]);
  });
});
