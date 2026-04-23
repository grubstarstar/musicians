import { getTokenFromRequest, verifyToken } from '../auth.js';

// Context user shape. `roles` (MUS-86) is sourced from the JWT payload so
// procedures can authorise on role without an extra DB read. Free-text today;
// `hasRole(user, role)` in `auth.ts` is the only sanctioned entry point.
export interface ContextUser {
  id: string;
  username: string;
  roles: string[];
}

export async function createContext({ req }: { req: Request }): Promise<{
  user: ContextUser | null;
}> {
  const token = getTokenFromRequest(req);
  if (!token) return { user: null };
  const payload = await verifyToken(token);
  if (!payload) return { user: null };
  return {
    user: {
      id: payload.sub,
      username: payload.username,
      roles: payload.roles,
    },
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
