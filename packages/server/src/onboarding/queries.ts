import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db.js';
import {
  bandMembers,
  musicianProfiles,
  promotersPromoterGroups,
  requests,
  userRoles,
  users,
} from '../schema.js';
import {
  resolveResumeStep,
  type OnboardingEvidence,
  type OnboardingStep,
} from './resumeStep.js';

/**
 * Roles the onboarding role-picker (MUS-89) is allowed to set. The schema
 * column `users.roles` is deliberately free-text (MUS-86) to avoid shipping
 * enum migrations every time product adds a role, but the first-run
 * onboarding wizard has a fixed shortlist — musician or promoter at launch
 * — so we gate that choice here rather than accepting arbitrary strings.
 *
 * Kept as a tuple-backed `as const` array so we can derive both the Zod
 * enum schema (in the router) and the TS union type from a single source.
 */
export const ONBOARDING_ROLES = ['musician', 'promoter'] as const;
export type OnboardingRole = (typeof ONBOARDING_ROLES)[number];

/**
 * Idempotently append `role` to `users.roles` for the given user. If the
 * role is already present, this is a no-op and the current row is returned
 * unchanged — mirrors the acceptance criterion on MUS-89 that re-submitting
 * the same role must not error.
 *
 * Returns the post-operation `roles` array so the client can update its
 * local state without an extra round-trip. Shaped projection per the tRPC
 * conventions in CLAUDE.md (no bare `db.select().from(...)`).
 */
export async function addUserRole(
  userId: number,
  role: OnboardingRole,
): Promise<{ roles: string[] }> {
  // Fetch the current roles so we can short-circuit when the role is already
  // present. Reading first + writing second races with a concurrent update,
  // but `array_append` on the already-present-case would just produce a
  // duplicate; see the `array_position IS NULL` guard in the UPDATE below for
  // the authoritative idempotency.
  const [existing] = await db
    .select({ roles: users.roles })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!existing) {
    // Caller should have been authenticated so the row must exist — surface a
    // clear error rather than silently inserting.
    throw new Error(`addUserRole: user ${userId} not found`);
  }
  if (existing.roles.includes(role)) {
    return { roles: existing.roles };
  }

  // `array_append` with a guard in the WHERE clause: only write when the role
  // isn't already in the array. Postgres' `array_position(arr, val)` returns
  // NULL when the value isn't present, so the predicate makes the UPDATE a
  // no-op under a concurrent append of the same role. The `returning` gives
  // us the post-update state; if the guard short-circuits, we re-read.
  const [updated] = await db
    .update(users)
    .set({ roles: sql`array_append(${users.roles}, ${role})` })
    .where(
      sql`${users.id} = ${userId} AND array_position(${users.roles}, ${role}) IS NULL`,
    )
    .returning({ roles: users.roles });

  if (updated) {
    return { roles: updated.roles };
  }

  // Guard matched an already-present role (race with a parallel append). Read
  // back the current state so the client sees the winning value.
  const [afterRace] = await db
    .select({ roles: users.roles })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!afterRace) {
    throw new Error(`addUserRole: user ${userId} disappeared mid-update`);
  }
  return { roles: afterRace.roles };
}

/**
 * Gather the per-user evidence counters used by `resolveResumeStep` to decide
 * where the onboarding wizard should resume. Runs one query per evidence
 * category — small number of lightweight COUNT(*)-ish probes against indexed
 * columns. Could be one-big-UNION but the readability cost outweighs the
 * round-trip savings at this volume (six queries run in parallel via
 * `Promise.all`).
 *
 * Returns a shape matching `OnboardingEvidence`; the pure resolver layer
 * does the rule work.
 *
 * Notes:
 * - "Promoter group membership" is resolved through `user_roles` →
 *   `promoters_promoter_groups` (the same path as `isMemberOfPromoterGroup`
 *   and `listMyPromoterGroups`). A row on `promoters_promoter_groups` exists
 *   iff the user has been linked to a group as a promoter, which is exactly
 *   what the AC means by "promoter_group_members row".
 * - Pending `band_join` / `promoter_group_join` are detected by the discrete
 *   `(kind, status)` filter on `requests`; we count them rather than exists-check
 *   because the resolver only needs > 0 either way, and Drizzle produces a
 *   cleaner projection with an explicit SELECT.
 * - `available_for_session_work` is read from `musician_profiles` (1:1 with
 *   users); we fall back to `false` if no row exists (user never entered the
 *   session-musician branch).
 */
export async function getOnboardingEvidence(
  userId: number,
): Promise<OnboardingEvidence> {
  const [
    userRow,
    bandMemberRows,
    sessionProfileRow,
    pendingBandJoinRows,
    promoterGroupMemberRows,
    pendingPromoterGroupJoinRows,
  ] = await Promise.all([
    // Read roles fresh from the DB rather than trusting `ctx.user.roles` —
    // the JWT snapshots roles at login time and may be stale if onboarding
    // mutations have modified them since. The resume-step query is the
    // authoritative read, so it must use authoritative data.
    db
      .select({ roles: users.roles })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({ band_id: bandMembers.band_id })
      .from(bandMembers)
      .where(eq(bandMembers.user_id, userId))
      .limit(1),
    db
      .select({
        availableForSessionWork: musicianProfiles.available_for_session_work,
      })
      .from(musicianProfiles)
      .where(eq(musicianProfiles.user_id, userId))
      .limit(1),
    db
      .select({ id: requests.id })
      .from(requests)
      .where(
        and(
          eq(requests.source_user_id, userId),
          eq(requests.kind, 'band_join'),
          eq(requests.status, 'open'),
        ),
      )
      .limit(1),
    // Promoter group membership goes through `user_roles` (the join table
    // FKs `user_roles.id`, not `users.id` directly). A single matching row
    // from the innerJoin is enough to prove "at least one".
    db
      .select({ id: promotersPromoterGroups.id })
      .from(promotersPromoterGroups)
      .innerJoin(
        userRoles,
        eq(userRoles.id, promotersPromoterGroups.user_role_id),
      )
      .where(and(eq(userRoles.user_id, userId), eq(userRoles.role, 'promoter')))
      .limit(1),
    db
      .select({ id: requests.id })
      .from(requests)
      .where(
        and(
          eq(requests.source_user_id, userId),
          eq(requests.kind, 'promoter_group_join'),
          eq(requests.status, 'open'),
        ),
      )
      .limit(1),
  ]);

  // A missing user row shouldn't be possible (caller is authenticated) but
  // if the row were deleted mid-session we'd rather return an empty roles
  // array and route to role-picker than crash — the next login round-trip
  // will surface the deletion via a 401 from /me.
  const roles = userRow[0]?.roles ?? [];

  return {
    roles,
    bandMemberCount: bandMemberRows.length,
    availableForSessionWork:
      sessionProfileRow[0]?.availableForSessionWork ?? false,
    pendingBandJoinCount: pendingBandJoinRows.length,
    promoterGroupMemberCount: promoterGroupMemberRows.length,
    pendingPromoterGroupJoinCount: pendingPromoterGroupJoinRows.length,
  };
}

/**
 * Compose the evidence + resolver steps and return the resume step the
 * client should route to. Thin wrapper exposed to the tRPC surface.
 */
export async function getResumeStep(userId: number): Promise<OnboardingStep> {
  const evidence = await getOnboardingEvidence(userId);
  return resolveResumeStep(evidence);
}
