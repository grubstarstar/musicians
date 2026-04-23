import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db.js';
import {
  promoterGroups,
  promoterGroupsVenues,
  promotersPromoterGroups,
  userRoles,
  users,
  venues,
} from '../schema.js';
import {
  shapePromoterGroupDetail,
  type PromoterGroupDetail,
} from './shapePromoterGroupDetail.js';

/**
 * Fetches the detail view of a single promoter group for a caller who is a
 * member of it. Returns `null` when the caller is not a member — the tRPC
 * procedure converts that into a NOT_FOUND error so non-members cannot
 * fingerprint the existence of a group from the error code (matches the
 * MUS-58 / MUS-70 pattern).
 *
 * Resolution path:
 *   user_roles (role = 'promoter', user_id = caller)
 *     → promoters_promoter_groups (promoter_group_id = id)
 *     → promoter_groups
 *   +                                  → promoter_groups_venues → venues
 *   +                                  → promoters_promoter_groups → user_roles → users   (full member list)
 *
 * Three round trips: one gated membership check, then venues and members in
 * parallel. The "is this caller a member" check happens up front so non-members
 * never see the venue/member rows — the caller controls when and how to map
 * null → NOT_FOUND.
 */
export async function getPromoterGroupDetail(
  callerUserId: number,
  groupId: number,
): Promise<PromoterGroupDetail | null> {
  // Membership + base group row in a single query. Inner join through
  // user_roles enforces `role='promoter'` — a user who is a member of the group
  // through a non-promoter role (not currently possible, but defensive against
  // future schema drift) would be rejected here.
  const [group] = await db
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
    .where(
      and(
        eq(promoterGroups.id, groupId),
        eq(userRoles.user_id, callerUserId),
        eq(userRoles.role, 'promoter'),
      ),
    )
    .limit(1);

  if (!group) return null;

  const [venueRows, memberRows] = await Promise.all([
    db
      .select({
        id: venues.id,
        name: venues.name,
        address: venues.address,
      })
      .from(promoterGroupsVenues)
      .innerJoin(venues, eq(venues.id, promoterGroupsVenues.venue_id))
      .where(eq(promoterGroupsVenues.promoter_group_id, group.id))
      .orderBy(asc(venues.name)),

    // Member list: every user linked to this group through
    // promoters_promoter_groups → user_roles (role='promoter') → users. Sorted
    // by username for a stable UI order — the schema does not expose a
    // "display name" column, so username is the natural tiebreaker.
    db
      .select({
        userId: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(promotersPromoterGroups)
      .innerJoin(userRoles, eq(userRoles.id, promotersPromoterGroups.user_role_id))
      .innerJoin(users, eq(users.id, userRoles.user_id))
      .where(
        and(
          eq(promotersPromoterGroups.promoter_group_id, group.id),
          eq(userRoles.role, 'promoter'),
        ),
      )
      .orderBy(asc(users.username)),
  ]);

  return shapePromoterGroupDetail(group, venueRows, memberRows);
}
