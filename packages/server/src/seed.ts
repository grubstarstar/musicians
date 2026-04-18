import bcrypt from 'bcrypt';
import { and, eq, isNull, sql as sqlTag } from 'drizzle-orm';
import { db, sql } from './db.js';
import { bands, bandTracks, users } from './schema.js';

const username = 'admin';
const password = 'password123';
const hash = await bcrypt.hash(password, 12);

const [existingAdmin] = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.username, username));

if (existingAdmin) {
  console.log(`User '${username}' already exists — skipped.`);
} else {
  await db.insert(users).values({ username, password_hash: hash });
  console.log(`Created user: ${username} / ${password}`);
}

const defaultBandNames = [
  'The Skylarks',
  'Night Owls',
  'Velvet Rum',
  'Solar Flare',
  'Pale Blue',
  'Rust & Bone',
  'Lit. Allusions',
];

const [{ count: bandCount }] = await db
  .select({ count: sqlTag<number>`count(*)::int` })
  .from(bands);

if (bandCount === 0) {
  await db.insert(bands).values(defaultBandNames.map((name) => ({ name })));
  console.log(`Seeded ${defaultBandNames.length} default bands.`);
} else {
  console.log(`Bands table already has ${bandCount} row(s) — skipped default-band seed.`);
}

const allBands = await db.select({ id: bands.id, name: bands.name }).from(bands);

for (const band of allBands) {
  const slug = band.name.toLowerCase().replace(/\s+/g, '-');
  const imageUrl = `https://picsum.photos/seed/${slug}/600/400`;
  await db
    .update(bands)
    .set({ imageUrl })
    .where(and(eq(bands.id, band.id), isNull(bands.imageUrl)));
  console.log(`Set image for band: ${band.name}`);
}

const trackPool = [
  { title: 'Song One', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { title: 'Song Two', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { title: 'Song Three', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { title: 'Song Four', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { title: 'Song Five', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
];

for (let i = 0; i < allBands.length; i++) {
  const band = allBands[i];
  const [{ count }] = await db
    .select({ count: sqlTag<number>`count(*)::int` })
    .from(bandTracks)
    .where(eq(bandTracks.band_id, band.id));

  if (count > 0) {
    console.log(`Band '${band.name}' already has tracks — skipped.`);
    continue;
  }

  const track1 = trackPool[i % trackPool.length];
  const track2 = trackPool[(i + 1) % trackPool.length];
  await db.insert(bandTracks).values([
    { band_id: band.id, title: track1.title, url: track1.url, position: 0 },
    { band_id: band.id, title: track2.title, url: track2.url, position: 1 },
  ]);
  console.log(`Seeded 2 tracks for band: ${band.name}`);
}

await sql.end();
