// MUS-95: pure helper for the Settings → Add role picker. Given the user's
// current `roles` array (as stored on `users.roles` and mirrored into
// AuthContext), returns the roles the user can still add.
//
// Kept as a pure function in `src/utils/` so it's trivially unit-testable and
// so the "which roles are addable" rule lives in exactly one place — the
// settings picker and any future callers (e.g. a confirmation screen) read
// the same list.
//
// The allow-list mirrors `ONBOARDING_ROLES` on the server (MUS-89 defined the
// set as `musician` | `promoter` for launch). We keep that list here as a
// separate source rather than importing from `@musicians/server` because
// mobile deliberately doesn't depend on server internals — and the list is
// short enough that divergence risk is low. If a new role slot is added to
// the onboarding wizard, update both sites. A lint-style reminder comment on
// the server helper's ONBOARDING_ROLES would help, but is out of scope here.

export const ADDABLE_ROLES = ['musician', 'promoter'] as const;
export type AddableRole = (typeof ADDABLE_ROLES)[number];

/**
 * Filter the master addable-role list down to roles the user hasn't got yet.
 *
 * @param currentRoles The user's current `roles` array. Values outside of
 *   `ADDABLE_ROLES` are ignored — they simply mean "this user has other
 *   roles that aren't addable via this picker", which doesn't change what
 *   we offer.
 * @returns The addable roles in the order declared by `ADDABLE_ROLES`.
 *   Preserving declaration order keeps the picker's visual order stable.
 */
export function computeAddableRoles(
  currentRoles: readonly string[],
): readonly AddableRole[] {
  return ADDABLE_ROLES.filter((role) => !currentRoles.includes(role));
}
