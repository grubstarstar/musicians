import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db.js';
import type { CreateEntityResult } from '../onboarding/createEntityResult.js';
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

/**
 * Creates a promoter group with the caller as the first (and, in `solo`
 * mode, only) member. Used by the MUS-92 name-first create flow from the
 * onboarding wizard.
 *
 * Sequence (all in a single transaction so a partial state is impossible):
 *   1. Ensure the caller has a `user_roles` row with role='promoter'. The
 *      promoters_promoter_groups join table FKs to `user_roles.id`, not
 *      `users.id`, so the role row must exist before the membership row can
 *      be inserted. Idempotent via the (user_id, role) unique index.
 *   2. Insert the promoter_groups row, recording `created_by_user_id` so the
 *      profile screen can gate the "Add members" CTA to the creator only.
 *   3. Insert the promoters_promoter_groups membership row linking the
 *      promoter user_role to the new group.
 *
 * Returns `{ id, memberMode: 'promoterGroup' }`. The caller (the procedure)
 * narrows `memberMode` to `'solo'` when the input mode requested it — this
 * helper always returns `'promoterGroup'` so it stays single-purpose.
 */
export async function createPromoterGroupWithCreator(
  input: { name: string },
  creatorUserId: number,
): Promise<CreateEntityResult> {
  return db.transaction(async (tx) => {
    // Idempotent role grant — `user_roles_user_id_role_uq` swallows repeat
    // inserts via `onConflictDoNothing`. We then read the row id back rather
    // than relying on `.returning()` from the upsert (returning is empty when
    // the conflict path is taken).
    await tx
      .insert(userRoles)
      .values({ user_id: creatorUserId, role: 'promoter' })
      .onConflictDoNothing();
    const [promoterRole] = await tx
      .select({ id: userRoles.id })
      .from(userRoles)
      .where(
        and(eq(userRoles.user_id, creatorUserId), eq(userRoles.role, 'promoter')),
      )
      .limit(1);
    // The insert+select must produce a row — the unique index guarantees
    // exactly one promoter row per user. Fail loudly if Postgres surprises us.
    if (!promoterRole) {
      throw new Error(
        'createPromoterGroupWithCreator: promoter user_role row missing after upsert',
      );
    }

    const [inserted] = await tx
      .insert(promoterGroups)
      .values({ name: input.name, created_by_user_id: creatorUserId })
      .returning({ id: promoterGroups.id });

    await tx.insert(promotersPromoterGroups).values({
      user_role_id: promoterRole.id,
      promoter_group_id: inserted.id,
    });

    return { id: inserted.id, memberMode: 'promoterGroup' };
  });
}
