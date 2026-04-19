import bcrypt from 'bcrypt';
import { and, eq, isNull, sql as sqlTag } from 'drizzle-orm';
import { db, sql } from './db.js';
import { bandMembers, bands, bandTracks, users } from './schema.js';

const defaultPassword = 'password123';
const defaultHash = await bcrypt.hash(defaultPassword, 12);

const seedUsers = [
  { username: 'admin', firstName: null, lastName: null },
  { username: 'rich', firstName: 'Richard', lastName: 'Garner' },
  { username: 'alex', firstName: 'Alex', lastName: 'Chen' },
  { username: 'sam', firstName: 'Sam', lastName: 'Taylor' },
  { username: 'jordan', firstName: 'Jordan', lastName: 'Miles' },
  { username: 'casey', firstName: 'Casey', lastName: 'Park' },
  { username: 'dana', firstName: 'Dana', lastName: 'Cruz' },
  { username: 'robin', firstName: 'Robin', lastName: 'Lee' },
  { username: 'pat', firstName: 'Pat', lastName: 'Quinn' },
];

for (const u of seedUsers) {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, u.username));

  if (existing) {
    console.log(`User '${u.username}' already exists — skipped.`);
  } else {
    await db.insert(users).values({
      username: u.username,
      password_hash: defaultHash,
      firstName: u.firstName,
      lastName: u.lastName,
    });
    console.log(`Created user: ${u.username} / ${defaultPassword}`);
  }
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

const membershipsByBandName: Record<string, string[]> = {
  'The Skylarks': ['rich', 'alex', 'sam'],
  'Night Owls': ['jordan', 'casey', 'robin'],
  'Velvet Rum': ['dana', 'pat', 'rich'],
  'Solar Flare': ['alex', 'jordan'],
  'Pale Blue': ['sam', 'casey'],
  'Rust & Bone': ['pat', 'robin', 'dana'],
  'Lit. Allusions': ['jordan', 'pat', 'rich', 'alex'],
};

const userIdByUsername = new Map<string, number>();
const allUsers = await db.select({ id: users.id, username: users.username }).from(users);
for (const u of allUsers) userIdByUsername.set(u.username, u.id);

for (const band of allBands) {
  const usernames = membershipsByBandName[band.name] ?? [];
  if (usernames.length === 0) continue;

  const [{ count }] = await db
    .select({ count: sqlTag<number>`count(*)::int` })
    .from(bandMembers)
    .where(eq(bandMembers.band_id, band.id));

  if (count > 0) {
    console.log(`Band '${band.name}' already has members — skipped.`);
    continue;
  }

  const rows = usernames
    .map((u) => userIdByUsername.get(u))
    .filter((id): id is number => typeof id === 'number')
    .map((user_id) => ({ band_id: band.id, user_id }));

  if (rows.length > 0) {
    await db.insert(bandMembers).values(rows);
    console.log(`Seeded ${rows.length} members for band: ${band.name}`);
  }
}

await sql.end();
