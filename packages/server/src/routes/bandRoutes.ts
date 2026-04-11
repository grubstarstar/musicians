import { Hono } from 'hono';
import type { Context } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db.js';
import { bands, bandMembers, bandTracks, users } from '../schema.js';
import type { BandWithMembers, BandProfile } from '../schema.js';
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

  const allBands = await db.select().from(bands).orderBy(asc(bands.name));

  const allMembers = await db
    .select({
      band_id: bandMembers.band_id,
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(bandMembers)
    .innerJoin(users, eq(users.id, bandMembers.user_id));

  const result: BandWithMembers[] = allBands.map((band) => ({
    ...band,
    members: allMembers
      .filter((m) => m.band_id === band.id)
      .map(({ id, username, firstName, lastName }) => ({ id, username, firstName, lastName })),
  }));

  return c.json(result);
});

// Get a single band profile (members + tracks)
bandRoutes.get('/:id', async (c) => {
  if (!await requireAuth(c)) return c.json({ error: 'Unauthorized' }, 401);

  const id = Number(c.req.param('id'));
  const [band] = await db.select().from(bands).where(eq(bands.id, id));
  if (!band) return c.json({ error: 'Not found' }, 404);

  const members = await db
    .select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName })
    .from(bandMembers)
    .innerJoin(users, eq(users.id, bandMembers.user_id))
    .where(eq(bandMembers.band_id, id));

  const tracks = await db
    .select({ id: bandTracks.id, title: bandTracks.title, url: bandTracks.url, position: bandTracks.position })
    .from(bandTracks)
    .where(eq(bandTracks.band_id, id))
    .orderBy(asc(bandTracks.position));

  const profile: BandProfile = { ...band, members, tracks };
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
