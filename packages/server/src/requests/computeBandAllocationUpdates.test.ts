import { describe, expect, it } from 'vitest';
import { computeBandAllocationUpdates } from './computeBandAllocationUpdates.js';

describe('computeBandAllocationUpdates', () => {
  it('returns an empty list when there are no siblings', () => {
    expect(computeBandAllocationUpdates([], 'bass')).toEqual([]);
  });

  it('returns an empty list when the joining instrument is blank', () => {
    expect(
      computeBandAllocationUpdates(
        [
          {
            id: 1,
            slotsFilled: 0,
            slotCount: 1,
            instrument: 'bass',
            pendingEoiIds: [],
          },
        ],
        '   ',
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
            instrument: 'Bass',
            pendingEoiIds: [],
          },
        ],
        'bass',
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
            instrument: 'bass',
            pendingEoiIds: [],
          },
        ],
        'bass',
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
            instrument: 'bass',
            pendingEoiIds: [101, 102, 103],
          },
        ],
        'bass',
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
            instrument: 'bass',
            pendingEoiIds: [201, 202],
          },
        ],
        'bass',
      ),
    ).toEqual([
      { id: 11, newSlotsFilled: 2, shouldClose: false, eoiIdsToAutoReject: [] },
    ]);
  });

  it('omits siblings whose instrument does not match', () => {
    // A drummer joining does not affect the band's open bass-player search.
    expect(
      computeBandAllocationUpdates(
        [
          {
            id: 1,
            slotsFilled: 0,
            slotCount: 1,
            instrument: 'bass',
            pendingEoiIds: [901],
          },
          {
            id: 2,
            slotsFilled: 0,
            slotCount: 1,
            instrument: 'guitar',
            pendingEoiIds: [902],
          },
        ],
        'drums',
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
            instrument: 'Bass Guitar',
            pendingEoiIds: [901],
          },
          // Non-matching — untouched
          {
            id: 2,
            slotsFilled: 0,
            slotCount: 2,
            instrument: 'drums',
            pendingEoiIds: [902, 903],
          },
          // Matching — stays open
          {
            id: 3,
            slotsFilled: 0,
            slotCount: 3,
            instrument: 'bass guitar',
            pendingEoiIds: [904],
          },
        ],
        'bass guitar',
      ),
    ).toEqual([
      { id: 1, newSlotsFilled: 1, shouldClose: true, eoiIdsToAutoReject: [901] },
      { id: 3, newSlotsFilled: 1, shouldClose: false, eoiIdsToAutoReject: [] },
    ]);
  });

  it('treats case + whitespace differences as matching (same normalisation as matchesMusicianRequest)', () => {
    expect(
      computeBandAllocationUpdates(
        [
          {
            id: 1,
            slotsFilled: 0,
            slotCount: 1,
            instrument: '  BASS  ',
            pendingEoiIds: [],
          },
        ],
        'bass',
      ),
    ).toEqual([
      { id: 1, newSlotsFilled: 1, shouldClose: true, eoiIdsToAutoReject: [] },
    ]);
  });

  it('does not mutate the input array', () => {
    const siblings = [
      {
        id: 1,
        slotsFilled: 0,
        slotCount: 2,
        instrument: 'bass',
        pendingEoiIds: [42],
      },
    ];
    computeBandAllocationUpdates(siblings, 'bass');
    expect(siblings).toEqual([
      {
        id: 1,
        slotsFilled: 0,
        slotCount: 2,
        instrument: 'bass',
        pendingEoiIds: [42],
      },
    ]);
  });
});
