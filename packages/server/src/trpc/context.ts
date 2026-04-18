import { getTokenFromRequest, verifyToken } from '../auth.js';

export async function createContext({ req }: { req: Request }): Promise<{
  user: { id: string; username: string } | null;
}> {
  const token = getTokenFromRequest(req);
  if (!token) return { user: null };
  const payload = await verifyToken(token);
  if (!payload) return { user: null };
  return { user: { id: payload.sub, username: payload.username } };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
