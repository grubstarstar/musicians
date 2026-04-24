import { resolveAuthedUser } from '../authedUser.js';

// Context user shape. Identity (`id`, `username`) comes from the JWT; `roles`
// is read from `users.roles` in the DB at request time, not the JWT payload —
// see MUS-101. This means any role mutation (onboarding.setRole,
// users.addRole, etc.) is visible on the very next authenticated request
// without re-issuing a token. `hasRole(user, role)` in `auth.ts` is the only
// sanctioned entry point for role checks.
export interface ContextUser {
  id: string;
  username: string;
  roles: string[];
}

export async function createContext({ req }: { req: Request }): Promise<{
  user: ContextUser | null;
}> {
  // `resolveAuthedUser` returns `null` for any failure case — missing token,
  // bad signature, expired token, OR (MUS-101) a JWT whose `sub` refers to a
  // deleted user. All of these collapse to "unauthenticated" at the context
  // boundary; downstream `protectedProcedure` throws UNAUTHORIZED on null.
  const user = await resolveAuthedUser(req);
  return { user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
