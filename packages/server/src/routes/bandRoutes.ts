import { Hono } from 'hono';
import type { Context } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db } from '../db.js';
import { bands, bandMembers } from '../schema.js';
import { getBandProfile, listBands } from '../bands/queries.js';
import { verifyToken, getTokenFromCookie } from '../auth.js';

const bandRoutes = new Hono();

async function requireAuth(c: Context) {
  const token = getTokenFromCookie(c.req.header('cookie'));
  if (!token) return null;
  return verifyToken(token);
}

// List all bands with their members
bandRoutes.get('/', async (c) => {
  if (!await requireAuth(c)) return c.json({ error: 'Unauthorized' }, 401);
  return c.json(await listBands());
});

// Get a single band profile (members + tracks)
bandRoutes.get('/:id', async (c) => {
  if (!await requireAuth(c)) return c.json({ error: 'Unauthorized' }, 401);

  const id = Number(c.req.param('id'));
  const profile = await getBandProfile(id);
  if (!profile) return c.json({ error: 'Not found' }, 404);
  return c.json(profile);
});

// Create a band
bandRoutes.post('/', async (c) => {
  if (!await requireAuth(c)) return c.json({ error: 'Unauthorized' }, 401);

  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: 'Name is required' }, 400);

  const [inserted] = await db.insert(bands).values({ name: name.trim() }).returning();
  return c.json({ id: inserted.id, name: inserted.name }, 201);
});

// Delete a band
bandRoutes.delete('/:id', async (c) => {
  if (!await requireAuth(c)) return c.json({ error: 'Unauthorized' }, 401);

  const id = Number(c.req.param('id'));
  await db.delete(bands).where(eq(bands.id, id));
  return c.json({ ok: true });
});

// Add a member to a band
bandRoutes.post('/:id/members', async (c) => {
  if (!await requireAuth(c)) return c.json({ error: 'Unauthorized' }, 401);

  const bandId = Number(c.req.param('id'));
  const { userId } = await c.req.json<{ userId: number }>();
  if (!userId) return c.json({ error: 'userId is required' }, 400);

  try {
    await db.insert(bandMembers).values({ band_id: bandId, user_id: userId });
  } catch {
    return c.json({ error: 'Already a member' }, 409);
  }
  return c.json({ ok: true }, 201);
});

// Remove a member from a band
bandRoutes.delete('/:id/members/:userId', async (c) => {
  if (!await requireAuth(c)) return c.json({ error: 'Unauthorized' }, 401);

  const bandId = Number(c.req.param('id'));
  const userId = Number(c.req.param('userId'));
  await db
    .delete(bandMembers)
    .where(and(eq(bandMembers.band_id, bandId), eq(bandMembers.user_id, userId)));
  return c.json({ ok: true });
});

export default bandRoutes;
