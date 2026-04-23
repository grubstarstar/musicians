import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db.js';
import {
  promoterGroups,
  promoterGroupsVenues,
  promotersPromoterGroups,
  userRoles,
  venues,
} from '../schema.js';
import {
  groupVenuesByPromoterGroup,
  type ShapedPromoterGroup,
} from './groupVenuesByPromoterGroup.js';

/**
 * Lists promoter groups the given user belongs to, each paired with the
 * venues the group is linked to.
 *
 * Resolution path:
 *   user_roles (role = 'promoter')
 *     → promoters_promoter_groups
 *     → promoter_groups
 *     → promoter_groups_venues
 *     → venues
 *
 * Two round trips: first resolves the caller's promoter groups (joined
 * through their `user_roles` row), second fetches every venue linked to
 * those groups in a single batched `IN (...)` query. Grouping and the
 * per-group venue sort happen in `groupVenuesByPromoterGroup` so the logic
 * is testable without a live DB.
 *
 * Returns `[]` when the user has no `promoter` row in `user_roles` — the
 * inner join short-circuits and we never issue the second query. This
 * matches the ticket's AC: no promoter role → empty array, not an error.
 */
/**
 * Checks whether a user is a member of a specific promoter group. Membership
 * is resolved through the same path as `listMyPromoterGroups`:
 *   user_roles (role='promoter') → promoters_promoter_groups
 * Returns false when either link is absent. Used by `requests.create` to
 * reject `promoter_group_join` requests from users who are already members
 * (MUS-88), and by `respondToPromoterGroupJoin` to gate who can decide.
 */
export async function isMemberOfPromoterGroup(
  userId: number,
  promoterGroupId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: promotersPromoterGroups.id })
    .from(promotersPromoterGroups)
    .innerJoin(userRoles, eq(userRoles.id, promotersPromoterGroups.user_role_id))
    .where(
      and(
        eq(promotersPromoterGroups.promoter_group_id, promoterGroupId),
        eq(userRoles.user_id, userId),
        eq(userRoles.role, 'promoter'),
      ),
    )
    .limit(1);
  return !!row;
}

export async function listMyPromoterGroups(
  userId: number,
): Promise<ShapedPromoterGroup[]> {
  const myGroups = await db
    .select({
      id: promoterGroups.id,
      name: promoterGroups.name,
    })
    .from(promoterGroups)
    .innerJoin(
      promotersPromoterGroups,
      eq(promotersPromoterGroups.promoter_group_id, promoterGroups.id),
    )
    .innerJoin(userRoles, eq(userRoles.id, promotersPromoterGroups.user_role_id))
    .where(and(eq(userRoles.user_id, userId), eq(userRoles.role, 'promoter')))
    .orderBy(asc(promoterGroups.name));

  if (myGroups.length === 0) return [];

  const groupIds = myGroups.map((g) => g.id);

  const venueRows = await db
    .select({
      promoterGroupId: promoterGroupsVenues.promoter_group_id,
      id: venues.id,
      name: venues.name,
      address: venues.address,
    })
    .from(promoterGroupsVenues)
    .innerJoin(venues, eq(venues.id, promoterGroupsVenues.venue_id))
    .where(inArray(promoterGroupsVenues.promoter_group_id, groupIds))
    .orderBy(asc(venues.name));

  return groupVenuesByPromoterGroup(myGroups, venueRows);
}
