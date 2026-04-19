import { describe, expect, it } from 'vitest';
import { computeGigAllocationUpdates } from './computeGigAllocationUpdates.js';

describe('computeGigAllocationUpdates', () => {
  it('returns an empty list when no siblings', () => {
    expect(computeGigAllocationUpdates([])).toEqual([]);
  });

  it('auto-closes a single-slot sibling when its only slot is the one being filled', () => {
    expect(
      computeGigAllocationUpdates([
        { id: 1, slotsFilled: 0, slotCount: 1, pendingEoiIds: [] },
      ]),
    ).toEqual([{ id: 1, newSlotsFilled: 1, shouldClose: true, eoiIdsToAutoReject: [] }]);
  });

  it('keeps a multi-slot sibling open if slots remain after this allocation', () => {
    expect(
      computeGigAllocationUpdates([
        { id: 7, slotsFilled: 1, slotCount: 3, pendingEoiIds: [] },
      ]),
    ).toEqual([{ id: 7, newSlotsFilled: 2, shouldClose: false, eoiIdsToAutoReject: [] }]);
  });

  it('auto-closes a multi-slot sibling when the last slot is being filled', () => {
    expect(
      computeGigAllocationUpdates([
        { id: 7, slotsFilled: 2, slotCount: 3, pendingEoiIds: [] },
      ]),
    ).toEqual([{ id: 7, newSlotsFilled: 3, shouldClose: true, eoiIdsToAutoReject: [] }]);
  });

  it('auto-rejects every pending EoI on a sibling that closes', () => {
    expect(
      computeGigAllocationUpdates([
        { id: 10, slotsFilled: 0, slotCount: 1, pendingEoiIds: [101, 102, 103] },
      ]),
    ).toEqual([
      { id: 10, newSlotsFilled: 1, shouldClose: true, eoiIdsToAutoReject: [101, 102, 103] },
    ]);
  });

  it('does not auto-reject pending EoIs on a sibling that stays open', () => {
    expect(
      computeGigAllocationUpdates([
        { id: 11, slotsFilled: 1, slotCount: 5, pendingEoiIds: [201, 202] },
      ]),
    ).toEqual([
      { id: 11, newSlotsFilled: 2, shouldClose: false, eoiIdsToAutoReject: [] },
    ]);
  });

  it('handles multiple siblings anchored to the same gig with different states', () => {
    expect(
      computeGigAllocationUpdates([
        { id: 1, slotsFilled: 0, slotCount: 1, pendingEoiIds: [901] }, // will close, auto-reject 901
        { id: 2, slotsFilled: 1, slotCount: 5, pendingEoiIds: [902, 903] }, // stays open
        { id: 3, slotsFilled: 4, slotCount: 5, pendingEoiIds: [] }, // closes, no pending
      ]),
    ).toEqual([
      { id: 1, newSlotsFilled: 1, shouldClose: true, eoiIdsToAutoReject: [901] },
      { id: 2, newSlotsFilled: 2, shouldClose: false, eoiIdsToAutoReject: [] },
      { id: 3, newSlotsFilled: 5, shouldClose: true, eoiIdsToAutoReject: [] },
    ]);
  });

  it('does not mutate the input array', () => {
    const siblings = [{ id: 1, slotsFilled: 0, slotCount: 2, pendingEoiIds: [42] }];
    computeGigAllocationUpdates(siblings);
    expect(siblings).toEqual([{ id: 1, slotsFilled: 0, slotCount: 2, pendingEoiIds: [42] }]);
  });
});
