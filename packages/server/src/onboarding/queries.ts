import { eq, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { users } from '../schema.js';

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
