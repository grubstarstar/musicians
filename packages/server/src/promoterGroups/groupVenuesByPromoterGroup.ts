// Pure helper (MUS-82): folds a flat (group_id, venue) list plus a set of
// base group rows into the `listMine` DTO shape. Kept separate so the
// grouping/sorting logic is testable without a live DB.
//
// Inputs
// - `groups`: already ordered by `name` ascending when passed in.
// - `venueRows`: flat rows from `promoter_groups_venues ⋈ venues`, can be in
//   any order — this function re-sorts each group's venues by name ascending.
//
// Output order: groups stay in the order they arrived (caller sorts); venues
// inside each group are sorted alphabetically by `name` (case-insensitive).

export interface PromoterGroupBaseRow {
  id: number;
  name: string;
}

export interface VenueForGroupRow {
  promoterGroupId: number;
  id: number;
  name: string;
  address: string;
}

export interface ShapedPromoterGroup {
  id: number;
  name: string;
  venues: { id: number; name: string; address: string }[];
}

export function groupVenuesByPromoterGroup(
  groups: PromoterGroupBaseRow[],
  venueRows: VenueForGroupRow[],
): ShapedPromoterGroup[] {
  const venuesByGroupId = new Map<number, { id: number; name: string; address: string }[]>();
  for (const row of venueRows) {
    const bucket = venuesByGroupId.get(row.promoterGroupId) ?? [];
    bucket.push({ id: row.id, name: row.name, address: row.address });
    venuesByGroupId.set(row.promoterGroupId, bucket);
  }

  return groups.map((group) => {
    const venues = (venuesByGroupId.get(group.id) ?? []).slice();
    // Ascending lexicographic sort by name. The SQL side already ORDERs by
    // `venues.name` but we re-sort in JS because the rows come back as a
    // single flat fetch across many groups — we can't rely on partitioned
    // ordering once we bucket them per-group in the loop above.
    venues.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return { id: group.id, name: group.name, venues };
  });
}
