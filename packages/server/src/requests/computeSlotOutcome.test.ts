import { describe, expect, it } from 'vitest';
import { computeSlotOutcome } from './computeSlotOutcome.js';

describe('computeSlotOutcome', () => {
  it('rejected: does not change slots_filled and does not close', () => {
    expect(computeSlotOutcome(0, 1, 'rejected')).toEqual({
      newSlotsFilled: 0,
      shouldCloseRequest: false,
    });
  });

  it('rejected on a partially-filled request: no change, no close', () => {
    expect(computeSlotOutcome(2, 5, 'rejected')).toEqual({
      newSlotsFilled: 2,
      shouldCloseRequest: false,
    });
  });

  it('accepted that fills the final slot: increments and closes', () => {
    expect(computeSlotOutcome(0, 1, 'accepted')).toEqual({
      newSlotsFilled: 1,
      shouldCloseRequest: true,
    });
  });

  it('accepted that fills the final of many slots: increments and closes', () => {
    expect(computeSlotOutcome(2, 3, 'accepted')).toEqual({
      newSlotsFilled: 3,
      shouldCloseRequest: true,
    });
  });

  it('accepted with room to spare: increments but does not close', () => {
    expect(computeSlotOutcome(0, 3, 'accepted')).toEqual({
      newSlotsFilled: 1,
      shouldCloseRequest: false,
    });
  });

  it('accepted past slot_count (defensive): still closes', () => {
    // Should not happen in practice (respond guards pending + open), but the
    // helper should not mis-report shouldCloseRequest when overfilled.
    expect(computeSlotOutcome(3, 3, 'accepted')).toEqual({
      newSlotsFilled: 4,
      shouldCloseRequest: true,
    });
  });
});
