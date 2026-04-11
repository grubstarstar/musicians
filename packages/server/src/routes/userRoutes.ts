import { Hono } from 'hono';
import { asc } from 'drizzle-orm';
import { db } from '../db.js';
import { users } from '../schema.js';
import { verifyToken, getTokenFromCookie } from '../auth.js';

const userRoutes = new Hono();

// List all users (id, username, firstName, lastName — no password hash)
userRoutes.get('/', async (c) => {
  const token = getTokenFromCookie(c.req.header('cookie'));
  if (!token || !await verifyToken(token)) return c.json({ error: 'Unauthorized' }, 401);

  const result = await db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .orderBy(asc(users.username));

  return c.json(result);
});

export default userRoutes;
