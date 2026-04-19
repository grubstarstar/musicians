import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db.js';
import { bandMembers, bands, requests } from '../schema.js';
import type { RequestDetails, RequestKind, RequestStatus } from '../schema.js';
import {
  buildRequestInsertValues,
  type RequestCreateInput,
} from './buildRequestInsertValues.js';

export interface ShapedRequest {
  id: number;
  kind: RequestKind;
  status: RequestStatus;
  slotCount: number;
  slotsFilled: number;
  details: RequestDetails;
  anchorBandId: number | null;
  createdAt: Date;
}

export interface ShapedRequestWithBand extends Omit<ShapedRequest, 'anchorBandId'> {
  band: { id: number; name: string; imageUrl: string | null };
}

export async function isMemberOfBand(userId: number, bandId: number): Promise<boolean> {
  const [row] = await db
    .select({ user_id: bandMembers.user_id })
    .from(bandMembers)
    .where(and(eq(bandMembers.band_id, bandId), eq(bandMembers.user_id, userId)))
    .limit(1);
  return !!row;
}

export async function createRequest(
  input: RequestCreateInput,
  userId: number,
): Promise<ShapedRequest> {
  const values = buildRequestInsertValues(input, userId);
  const [row] = await db
    .insert(requests)
    .values(values)
    .returning({
      id: requests.id,
      kind: requests.kind,
      status: requests.status,
      slotCount: requests.slot_count,
      slotsFilled: requests.slots_filled,
      details: requests.details,
      anchorBandId: requests.anchor_band_id,
      createdAt: requests.created_at,
    });
  return row;
}

export async function listOpenRequests(filter: {
  kind?: RequestKind;
}): Promise<ShapedRequestWithBand[]> {
  const whereClause = filter.kind
    ? and(eq(requests.status, 'open'), eq(requests.kind, filter.kind))
    : eq(requests.status, 'open');

  const rows = await db
    .select({
      id: requests.id,
      kind: requests.kind,
      status: requests.status,
      slotCount: requests.slot_count,
      slotsFilled: requests.slots_filled,
      details: requests.details,
      createdAt: requests.created_at,
      bandId: bands.id,
      bandName: bands.name,
      bandImageUrl: bands.imageUrl,
    })
    .from(requests)
    .innerJoin(bands, eq(bands.id, requests.anchor_band_id))
    .where(whereClause)
    .orderBy(desc(requests.created_at));

  return rows.map(({ bandId, bandName, bandImageUrl, ...r }) => ({
    ...r,
    band: { id: bandId, name: bandName, imageUrl: bandImageUrl },
  }));
}
