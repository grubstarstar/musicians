import type { RequestDetails, RequestKind, RequestStatus } from '../schema.js';

export type RequestCreateInput = {
  kind: 'musician-for-band';
  bandId: number;
  instrument: string;
  style?: string;
  rehearsalCommitment?: string;
};

export interface RequestInsertValues {
  kind: RequestKind;
  source_user_id: number;
  anchor_band_id: number | null;
  details: RequestDetails;
  slot_count: number;
  slots_filled: number;
  status: RequestStatus;
}

export function buildRequestInsertValues(
  input: RequestCreateInput,
  userId: number,
): RequestInsertValues {
  const details: RequestDetails = {
    kind: 'musician-for-band',
    instrument: input.instrument,
    ...(input.style !== undefined ? { style: input.style } : {}),
    ...(input.rehearsalCommitment !== undefined
      ? { rehearsalCommitment: input.rehearsalCommitment }
      : {}),
  };
  return {
    kind: 'musician-for-band',
    source_user_id: userId,
    anchor_band_id: input.bandId,
    details,
    slot_count: 1,
    slots_filled: 0,
    status: 'open',
  };
}
