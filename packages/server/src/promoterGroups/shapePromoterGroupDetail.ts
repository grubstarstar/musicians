// Pure helper (MUS-100): folds flat venue + member rows into the
// `promoterGroups.get` DTO shape. Kept separate so the assembly logic is
// testable without a live DB.
//
// Contract:
// - `group` is the base row `{ id, name }`.
// - `venueRows` is already filtered to this group's venues. Caller sorts by
//   name ascending; the helper does NOT re-sort (matching the DB `ORDER BY`).
// - `memberRows` is already filtered to this group's members. Caller sorts by
//   display-name-ish field; the helper does NOT re-sort.
//
// This helper is deliberately less involved than
// `groupVenuesByPromoterGroup` (which does a cross-group fold): `get` returns a
// single group, so we don't need the per-group bucketing step.

export interface PromoterGroupBaseRow {
  id: number;
  name: string;
}

export interface VenueRow {
  id: number;
  name: string;
  address: string;
}

export interface MemberRow {
  userId: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
}

export interface PromoterGroupDetail {
  id: number;
  name: string;
  venues: VenueRow[];
  members: MemberRow[];
}

export function shapePromoterGroupDetail(
  group: PromoterGroupBaseRow,
  venueRows: VenueRow[],
  memberRows: MemberRow[],
): PromoterGroupDetail {
  return {
    id: group.id,
    name: group.name,
    venues: venueRows.map((v) => ({ id: v.id, name: v.name, address: v.address })),
    members: memberRows.map((m) => ({
      userId: m.userId,
      username: m.username,
      firstName: m.firstName,
      lastName: m.lastName,
    })),
  };
}
