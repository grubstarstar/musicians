import bcrypt from 'bcrypt';
import { and, eq, isNull, sql as sqlTag } from 'drizzle-orm';
import { db, sql } from './db.js';
import { genreSeed } from './genres-seed.js';
import { instrumentSeed } from './instruments-seed.js';
import {
  bandMembers,
  bands,
  bandTracks,
  engineersLiveAudioGroups,
  engineersRecordingStudios,
  genres,
  gigs,
  gigSlots,
  instruments,
  liveAudioGroups,
  promoterGroups,
  promoterGroupsVenues,
  promotersPromoterGroups,
  recordingStudios,
  rehearsals,
  userRoles,
  users,
  venues,
  type UserRoleName,
} from './schema.js';

const defaultPassword = 'password123';
const defaultHash = await bcrypt.hash(defaultPassword, 12);

// --- MUS-68: instruments taxonomy ---
//
// Idempotent upsert-by-name: the seed list is the source of truth, so
// every run ensures each canonical name exists exactly once. Category is
// only set on insert — a later edit to an existing row's category should
// be intentional (manual SQL) rather than drifting on every seed. Uses
// `onConflictDoNothing` keyed on the unique name constraint.
{
  const existing = await db
    .select({ id: instruments.id, name: instruments.name })
    .from(instruments);
  const existingNames = new Set(existing.map((r) => r.name));
  const toInsert = instrumentSeed.filter((s) => !existingNames.has(s.name));
  if (toInsert.length === 0) {
    console.log(`Instruments taxonomy already has ${existing.length} row(s) — skipped seed.`);
  } else {
    await db.insert(instruments).values(toInsert).onConflictDoNothing();
    console.log(`Seeded ${toInsert.length} instrument(s); taxonomy now has ${existing.length + toInsert.length} rows.`);
  }
}

// --- MUS-103: genres taxonomy ---
//
// Idempotent upsert-by-slug. The migration seeds this on first apply too
// (see `0015_genres_taxonomy.sql`); both paths converge on the same canonical
// row set via `onConflictDoNothing` keyed on the unique slug constraint.
{
  const existing = await db.select({ id: genres.id, slug: genres.slug }).from(genres);
  const existingSlugs = new Set(existing.map((r) => r.slug));
  const toInsert = genreSeed.filter((s) => !existingSlugs.has(s.slug));
  if (toInsert.length === 0) {
    console.log(`Genres taxonomy already has ${existing.length} row(s) — skipped seed.`);
  } else {
    await db.insert(genres).values(toInsert).onConflictDoNothing();
    console.log(
      `Seeded ${toInsert.length} genre(s); taxonomy now has ${existing.length + toInsert.length} rows.`,
    );
  }
}

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

// --- MUS-48/MUS-56: rehearsals per band ---
//
// Originally this block seeded `events` (gigs + rehearsals). MUS-56 split
// public gigs into their own `gigs` + `gig_slots` tables, so the per-band
// table carries rehearsals only. Gig seeding happens further down, once the
// promoter admin user + venue are in place.

const rehearsalSpaces = ['Bakehouse Studios', 'Red Door Rehearsals', 'Wicks'];

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildRehearsalsForBand(bandId: number, bandIndex: number): {
  band_id: number;
  datetime: Date;
  venue: string;
  doors: string | null;
}[] {
  // Deterministic 2–4 rehearsals per band so re-seeds look identical.
  const count = 2 + (bandIndex % 3);
  const today = new Date();
  today.setUTCHours(19, 0, 0, 0);

  return Array.from({ length: count }, (_, i) => {
    const dayOffset = 3 + i * 7 + (bandIndex % 3);
    return {
      band_id: bandId,
      datetime: addDays(today, dayOffset),
      venue: rehearsalSpaces[(bandIndex + i) % rehearsalSpaces.length],
      doors: null,
    };
  });
}

for (let i = 0; i < allBands.length; i++) {
  const band = allBands[i];
  const [{ count }] = await db
    .select({ count: sqlTag<number>`count(*)::int` })
    .from(rehearsals)
    .where(eq(rehearsals.band_id, band.id));

  if (count > 0) {
    console.log(`Band '${band.name}' already has rehearsals — skipped.`);
    continue;
  }

  const rows = buildRehearsalsForBand(band.id, i);
  await db.insert(rehearsals).values(rows);
  console.log(`Seeded ${rows.length} rehearsals for band: ${band.name}`);
}

// --- MUS-6: roles + role-owned entities ---

async function ensureSingleton<
  T extends { id: number },
>(
  label: string,
  find: () => Promise<T | undefined>,
  create: () => Promise<T>,
): Promise<T> {
  const existing = await find();
  if (existing) {
    console.log(`${label} already exists — skipped.`);
    return existing;
  }
  const created = await create();
  console.log(`Created ${label}.`);
  return created;
}

const [adminRow] = await db.select({ id: users.id }).from(users).where(eq(users.username, 'admin'));

if (!adminRow) {
  console.warn('Admin user not found — cannot seed roles.');
} else {
  const adminRoleNames: UserRoleName[] = ['musician', 'promoter', 'engineer'];
  const adminRoleIds: Record<UserRoleName, number> = {
    musician: 0,
    promoter: 0,
    engineer: 0,
  };

  for (const role of adminRoleNames) {
    const [existing] = await db
      .select({ id: userRoles.id })
      .from(userRoles)
      .where(and(eq(userRoles.user_id, adminRow.id), eq(userRoles.role, role)));

    if (existing) {
      adminRoleIds[role] = existing.id;
      console.log(`Admin already has role '${role}' — skipped.`);
    } else {
      const [inserted] = await db
        .insert(userRoles)
        .values({ user_id: adminRow.id, role })
        .returning({ id: userRoles.id });
      adminRoleIds[role] = inserted.id;
      console.log(`Granted admin role '${role}'.`);
    }
  }

  const promoterGroup = await ensureSingleton(
    "promoter_group 'Sunset Presents'",
    async () => {
      const [row] = await db
        .select()
        .from(promoterGroups)
        .where(eq(promoterGroups.name, 'Sunset Presents'));
      return row;
    },
    async () => {
      const [row] = await db
        .insert(promoterGroups)
        .values({ name: 'Sunset Presents' })
        .returning();
      return row;
    },
  );

  const venue = await ensureSingleton(
    "venue 'The Corner Stage'",
    async () => {
      const [row] = await db
        .select()
        .from(venues)
        .where(eq(venues.name, 'The Corner Stage'));
      return row;
    },
    async () => {
      const [row] = await db
        .insert(venues)
        .values({ name: 'The Corner Stage', address: '123 Swanston St, Melbourne VIC 3000' })
        .returning();
      return row;
    },
  );

  const studio = await ensureSingleton(
    "recording_studio 'Echo Room Studios'",
    async () => {
      const [row] = await db
        .select()
        .from(recordingStudios)
        .where(eq(recordingStudios.name, 'Echo Room Studios'));
      return row;
    },
    async () => {
      const [row] = await db
        .insert(recordingStudios)
        .values({
          name: 'Echo Room Studios',
          address: '45 Brunswick St, Fitzroy VIC 3065',
        })
        .returning();
      return row;
    },
  );

  const liveAudioGroup = await ensureSingleton(
    "live_audio_group 'Front of House Collective'",
    async () => {
      const [row] = await db
        .select()
        .from(liveAudioGroups)
        .where(eq(liveAudioGroups.name, 'Front of House Collective'));
      return row;
    },
    async () => {
      const [row] = await db
        .insert(liveAudioGroups)
        .values({ name: 'Front of House Collective' })
        .returning();
      return row;
    },
  );

  // admin (promoter) -> promoter group
  const [promoterLink] = await db
    .select({ id: promotersPromoterGroups.id })
    .from(promotersPromoterGroups)
    .where(
      and(
        eq(promotersPromoterGroups.user_role_id, adminRoleIds.promoter),
        eq(promotersPromoterGroups.promoter_group_id, promoterGroup.id),
      ),
    );
  if (promoterLink) {
    console.log('Admin promoter → promoter_group link already exists — skipped.');
  } else {
    await db.insert(promotersPromoterGroups).values({
      user_role_id: adminRoleIds.promoter,
      promoter_group_id: promoterGroup.id,
    });
    console.log('Linked admin (promoter) to promoter_group.');
  }

  // promoter group -> venue
  const [venueLink] = await db
    .select({ id: promoterGroupsVenues.id })
    .from(promoterGroupsVenues)
    .where(
      and(
        eq(promoterGroupsVenues.promoter_group_id, promoterGroup.id),
        eq(promoterGroupsVenues.venue_id, venue.id),
      ),
    );
  if (venueLink) {
    console.log('promoter_group → venue link already exists — skipped.');
  } else {
    await db.insert(promoterGroupsVenues).values({
      promoter_group_id: promoterGroup.id,
      venue_id: venue.id,
    });
    console.log('Linked promoter_group to venue.');
  }

  // admin (engineer) -> recording studio
  const [studioLink] = await db
    .select({ id: engineersRecordingStudios.id })
    .from(engineersRecordingStudios)
    .where(
      and(
        eq(engineersRecordingStudios.user_role_id, adminRoleIds.engineer),
        eq(engineersRecordingStudios.recording_studio_id, studio.id),
      ),
    );
  if (studioLink) {
    console.log('Admin engineer → recording_studio link already exists — skipped.');
  } else {
    await db.insert(engineersRecordingStudios).values({
      user_role_id: adminRoleIds.engineer,
      recording_studio_id: studio.id,
    });
    console.log('Linked admin (engineer) to recording_studio.');
  }

  // admin (engineer) -> live audio group
  const [liveLink] = await db
    .select({ id: engineersLiveAudioGroups.id })
    .from(engineersLiveAudioGroups)
    .where(
      and(
        eq(engineersLiveAudioGroups.user_role_id, adminRoleIds.engineer),
        eq(engineersLiveAudioGroups.live_audio_group_id, liveAudioGroup.id),
      ),
    );
  if (liveLink) {
    console.log('Admin engineer → live_audio_group link already exists — skipped.');
  } else {
    await db.insert(engineersLiveAudioGroups).values({
      user_role_id: adminRoleIds.engineer,
      live_audio_group_id: liveAudioGroup.id,
    });
    console.log('Linked admin (engineer) to live_audio_group.');
  }

  // --- MUS-56: a sample gig organised by admin (promoter) at The Corner Stage ---
  //
  // Three open slots so the `band-for-gig-slot` flow has something to apply
  // to out of the box after a fresh seed.
  const [{ count: existingGigCount }] = await db
    .select({ count: sqlTag<number>`count(*)::int` })
    .from(gigs)
    .where(eq(gigs.organiser_user_id, adminRow.id));

  if (existingGigCount === 0) {
    const gigDatetime = new Date();
    gigDatetime.setUTCDate(gigDatetime.getUTCDate() + 21);
    gigDatetime.setUTCHours(20, 0, 0, 0);
    const [gig] = await db
      .insert(gigs)
      .values({
        datetime: gigDatetime,
        venue_id: venue.id,
        doors: '7pm',
        organiser_user_id: adminRow.id,
        status: 'open',
      })
      .returning({ id: gigs.id });
    await db.insert(gigSlots).values([
      { gig_id: gig.id, set_order: 0, fee: 25000 },
      { gig_id: gig.id, set_order: 1, fee: 30000 },
      { gig_id: gig.id, set_order: 2, fee: 40000 },
    ]);
    console.log(`Seeded sample gig #${gig.id} at '${venue.name}' with 3 open slots.`);
  } else {
    console.log('Admin already has seeded gig(s) — skipped.');
  }
}

await sql.end();
