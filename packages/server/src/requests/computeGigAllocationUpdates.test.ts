import { describe, expect, it } from 'vitest';
import { computeGigAllocationUpdates } from './computeGigAllocationUpdates.js';

describe('computeGigAllocationUpdates', () => {
  it('returns an empty list when no siblings', () => {
    expect(computeGigAllocationUpdates([])).toEqual([]);
  });

  it('auto-closes a single-slot sibling when its only slot is the one being filled', () => {
    expect(
      computeGigAllocationUpdates([
        { id: 1, slotsFilled: 0, slotCount: 1 },
      ]),
    ).toEqual([{ id: 1, newSlotsFilled: 1, shouldClose: true }]);
  });

  it('keeps a multi-slot sibling open if slots remain after this allocation', () => {
    expect(
      computeGigAllocationUpdates([
        { id: 7, slotsFilled: 1, slotCount: 3 },
      ]),
    ).toEqual([{ id: 7, newSlotsFilled: 2, shouldClose: false }]);
  });

  it('auto-closes a multi-slot sibling when the last slot is being filled', () => {
    expect(
      computeGigAllocationUpdates([
        { id: 7, slotsFilled: 2, slotCount: 3 },
      ]),
    ).toEqual([{ id: 7, newSlotsFilled: 3, shouldClose: true }]);
  });

  it('handles multiple siblings anchored to the same gig with different states', () => {
    expect(
      computeGigAllocationUpdates([
        { id: 1, slotsFilled: 0, slotCount: 1 }, // will close
        { id: 2, slotsFilled: 1, slotCount: 5 }, // will stay open
        { id: 3, slotsFilled: 4, slotCount: 5 }, // will close
      ]),
    ).toEqual([
      { id: 1, newSlotsFilled: 1, shouldClose: true },
      { id: 2, newSlotsFilled: 2, shouldClose: false },
      { id: 3, newSlotsFilled: 5, shouldClose: true },
    ]);
  });

  it('does not mutate the input array', () => {
    const siblings = [{ id: 1, slotsFilled: 0, slotCount: 2 }];
    computeGigAllocationUpdates(siblings);
    expect(siblings).toEqual([{ id: 1, slotsFilled: 0, slotCount: 2 }]);
  });
});
