// Pure helper for MUS-52 slot accounting.
//
// Given the current state of a request's slot counters and the decision being
// applied to a pending expression of interest, returns the next value for
// `slots_filled` and whether the request should auto-close.
//
// Kept intentionally dumb and dependency-free so it can be unit tested without
// any DB or tRPC surface. The `respond` mutation is the only caller today.

export type SlotDecision = 'accepted' | 'rejected';

export interface SlotOutcome {
  newSlotsFilled: number;
  shouldCloseRequest: boolean;
}

export function computeSlotOutcome(
  currentSlotsFilled: number,
  slotCount: number,
  decision: SlotDecision,
): SlotOutcome {
  if (decision === 'rejected') {
    return { newSlotsFilled: currentSlotsFilled, shouldCloseRequest: false };
  }
  const newSlotsFilled = currentSlotsFilled + 1;
  return {
    newSlotsFilled,
    shouldCloseRequest: newSlotsFilled >= slotCount,
  };
}
