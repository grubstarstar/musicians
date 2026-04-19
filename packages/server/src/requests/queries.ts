import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db.js';
import {
  bandMembers,
  bands,
  expressionsOfInterest,
  requests,
  users,
} from '../schema.js';
import type {
  EoiDetails,
  EoiState,
  RequestDetails,
  RequestKind,
  RequestStatus,
} from '../schema.js';
import {
  buildRequestInsertValues,
  type RequestCreateInput,
} from './buildRequestInsertValues.js';
import { sortEoisForManage, type SortableEoi } from './sortEoisForManage.js';

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

/**
 * Single-request read used by the Express Interest detail screen. Same shape
 * as a row from `listOpenRequests` so the detail / list views can share code.
 * Returns null if the request doesn't exist; caller maps to NOT_FOUND.
 */
export async function getOpenRequestWithBand(
  requestId: number,
): Promise<ShapedRequestWithBand | null> {
  const [row] = await db
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
    .where(eq(requests.id, requestId))
    .limit(1);

  if (!row) return null;
  const { bandId, bandName, bandImageUrl, ...rest } = row;
  return { ...rest, band: { id: bandId, name: bandName, imageUrl: bandImageUrl } };
}

// --- listMine (MUS-55) ---------------------------------------------------

export interface ShapedEoiForManage extends SortableEoi {
  id: number;
  state: EoiState;
  details: EoiDetails | null;
  createdAt: Date;
  decidedAt: Date | null;
  targetUser: {
    id: number;
    username: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface ShapedRequestWithEois extends ShapedRequestWithBand {
  updatedAt: Date;
  eois: ShapedEoiForManage[];
}

/**
 * Lists requests authored by the caller, regardless of status, newest first.
 * Each request embeds its EoIs with the target user summary. EoIs are sorted
 * pending-first, then most-recently decided (see `sortEoisForManage`).
 *
 * Shape is camelCase-only across the tRPC boundary — never a raw Drizzle row.
 */
export async function listMyRequests(userId: number): Promise<ShapedRequestWithEois[]> {
  const requestRows = await db
    .select({
      id: requests.id,
      kind: requests.kind,
      status: requests.status,
      slotCount: requests.slot_count,
      slotsFilled: requests.slots_filled,
      details: requests.details,
      createdAt: requests.created_at,
      updatedAt: requests.updated_at,
      bandId: bands.id,
      bandName: bands.name,
      bandImageUrl: bands.imageUrl,
    })
    .from(requests)
    .innerJoin(bands, eq(bands.id, requests.anchor_band_id))
    .where(eq(requests.source_user_id, userId))
    .orderBy(desc(requests.created_at));

  if (requestRows.length === 0) return [];

  const requestIds = requestRows.map((r) => r.id);

  // One batched fetch for EoIs across every request the caller owns — avoids
  // an N+1 per-request query. Group in memory afterwards.
  const eoiRows = await db
    .select({
      id: expressionsOfInterest.id,
      requestId: expressionsOfInterest.request_id,
      state: expressionsOfInterest.state,
      details: expressionsOfInterest.details,
      createdAt: expressionsOfInterest.created_at,
      decidedAt: expressionsOfInterest.decided_at,
      targetUserId: users.id,
      targetUsername: users.username,
      targetFirstName: users.firstName,
      targetLastName: users.lastName,
    })
    .from(expressionsOfInterest)
    .innerJoin(users, eq(users.id, expressionsOfInterest.target_user_id))
    .where(inArray(expressionsOfInterest.request_id, requestIds));

  return requestRows.map((r) => {
    const matching = eoiRows
      .filter((e) => e.requestId === r.id)
      .map<ShapedEoiForManage>((e) => ({
        id: e.id,
        state: e.state,
        details: e.details,
        createdAt: e.createdAt,
        decidedAt: e.decidedAt,
        targetUser: {
          id: e.targetUserId,
          username: e.targetUsername,
          firstName: e.targetFirstName,
          lastName: e.targetLastName,
        },
      }));
    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      slotCount: r.slotCount,
      slotsFilled: r.slotsFilled,
      details: r.details,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      band: { id: r.bandId, name: r.bandName, imageUrl: r.bandImageUrl },
      eois: sortEoisForManage(matching),
    };
  });
}
