import {
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').unique().notNull(),
  password_hash: text('password_hash').notNull(),
  firstName: text('firstName'),
  lastName: text('lastName'),
});

export const bands = pgTable('bands', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  imageUrl: text('imageUrl'),
});

export const bandTracks = pgTable('band_tracks', {
  id: serial('id').primaryKey(),
  band_id: integer('band_id').notNull().references(() => bands.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  url: text('url').notNull(),
  position: integer('position').notNull().default(0),
});

export const bandMembers = pgTable(
  'band_members',
  {
    band_id: integer('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.band_id, table.user_id] })],
);

// --- Roles and role-owned entities (MUS-6) ---

export const userRoleEnum = pgEnum('user_role', ['musician', 'promoter', 'engineer']);

export const userRoles = pgTable(
  'user_roles',
  {
    id: serial('id').primaryKey(),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: userRoleEnum('role').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('user_roles_user_id_role_uq').on(table.user_id, table.role)],
);

export const promoterGroups = pgTable('promoter_groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const venues = pgTable('venues', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const recordingStudios = pgTable('recording_studios', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const liveAudioGroups = pgTable('live_audio_groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Join tables (all many-to-many with surrogate PK + unique composite) ---

export const musiciansBands = pgTable(
  'musicians_bands',
  {
    id: serial('id').primaryKey(),
    user_role_id: integer('user_role_id')
      .notNull()
      .references(() => userRoles.id, { onDelete: 'cascade' }),
    band_id: integer('band_id')
      .notNull()
      .references(() => bands.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('musicians_bands_user_role_id_band_id_uq').on(table.user_role_id, table.band_id),
  ],
);

export const promotersPromoterGroups = pgTable(
  'promoters_promoter_groups',
  {
    id: serial('id').primaryKey(),
    user_role_id: integer('user_role_id')
      .notNull()
      .references(() => userRoles.id, { onDelete: 'cascade' }),
    promoter_group_id: integer('promoter_group_id')
      .notNull()
      .references(() => promoterGroups.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('promoters_promoter_groups_user_role_id_group_id_uq').on(
      table.user_role_id,
      table.promoter_group_id,
    ),
  ],
);

export const promoterGroupsVenues = pgTable(
  'promoter_groups_venues',
  {
    id: serial('id').primaryKey(),
    promoter_group_id: integer('promoter_group_id')
      .notNull()
      .references(() => promoterGroups.id, { onDelete: 'cascade' }),
    venue_id: integer('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('promoter_groups_venues_group_id_venue_id_uq').on(
      table.promoter_group_id,
      table.venue_id,
    ),
  ],
);

export const engineersRecordingStudios = pgTable(
  'engineers_recording_studios',
  {
    id: serial('id').primaryKey(),
    user_role_id: integer('user_role_id')
      .notNull()
      .references(() => userRoles.id, { onDelete: 'cascade' }),
    recording_studio_id: integer('recording_studio_id')
      .notNull()
      .references(() => recordingStudios.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('engineers_recording_studios_user_role_id_studio_id_uq').on(
      table.user_role_id,
      table.recording_studio_id,
    ),
  ],
);

export const engineersLiveAudioGroups = pgTable(
  'engineers_live_audio_groups',
  {
    id: serial('id').primaryKey(),
    user_role_id: integer('user_role_id')
      .notNull()
      .references(() => userRoles.id, { onDelete: 'cascade' }),
    live_audio_group_id: integer('live_audio_group_id')
      .notNull()
      .references(() => liveAudioGroups.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('engineers_live_audio_groups_user_role_id_group_id_uq').on(
      table.user_role_id,
      table.live_audio_group_id,
    ),
  ],
);

// --- Events (MUS-48) ---
//
// NOTE on MUS-44 forward-compat: `venue` is stored as freeform text intentionally.
// MUS-44 will introduce anchor/link objects (to venues, promoter groups, studios,
// etc.); those will arrive as additional nullable FK columns on this table, so
// nothing about the current shape needs to change when MUS-44 lands.

export const eventKindEnum = pgEnum('event_kind', ['gig', 'rehearsal']);

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  band_id: integer('band_id')
    .notNull()
    .references(() => bands.id, { onDelete: 'cascade' }),
  kind: eventKindEnum('kind').notNull(),
  datetime: timestamp('datetime', { withTimezone: true }).notNull(),
  venue: text('venue').notNull(),
  doors: text('doors'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Band = typeof bands.$inferSelect;
export type BandMember = typeof bandMembers.$inferSelect;
export type BandTrack = typeof bandTracks.$inferSelect;

export type UserRole = typeof userRoles.$inferSelect;
export type UserRoleName = (typeof userRoleEnum.enumValues)[number];
export type PromoterGroup = typeof promoterGroups.$inferSelect;
export type Venue = typeof venues.$inferSelect;
export type RecordingStudio = typeof recordingStudios.$inferSelect;
export type LiveAudioGroup = typeof liveAudioGroups.$inferSelect;

export type MusicianBand = typeof musiciansBands.$inferSelect;
export type PromoterPromoterGroup = typeof promotersPromoterGroups.$inferSelect;
export type PromoterGroupVenue = typeof promoterGroupsVenues.$inferSelect;
export type EngineerRecordingStudio = typeof engineersRecordingStudios.$inferSelect;
export type EngineerLiveAudioGroup = typeof engineersLiveAudioGroups.$inferSelect;

export type Event = typeof events.$inferSelect;
export type EventKind = (typeof eventKindEnum.enumValues)[number];

export interface BandWithMembers extends Band {
  members: Pick<User, 'id' | 'username' | 'firstName' | 'lastName'>[];
}

export interface BandProfile extends BandWithMembers {
  tracks: Pick<BandTrack, 'id' | 'title' | 'url' | 'position'>[];
}
