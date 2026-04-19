import {
  integer,
  jsonb,
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

// --- Rehearsals (MUS-48, renamed from `events` in MUS-56) ---
//
// Originally this table carried both gigs and rehearsals, discriminated by a
// `kind` enum. MUS-56 split them: public gigs with multi-band lineups live in
// `gigs` + `gig_slots` below, and this table is now rehearsals-only (no kind
// column). `venue` is still freeform text for rehearsals — real venue FKs are
// only required for public gigs.

export const rehearsals = pgTable('rehearsals', {
  id: serial('id').primaryKey(),
  band_id: integer('band_id')
    .notNull()
    .references(() => bands.id, { onDelete: 'cascade' }),
  datetime: timestamp('datetime', { withTimezone: true }).notNull(),
  venue: text('venue').notNull(),
  doors: text('doors'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Gigs + slots (MUS-56) ---
//
// A `gig` is a public show with a lineup of one or more bands, organised by
// a user (typically in the `promoter` role). Each `gig_slot` is a set in the
// lineup: may be open (band_id IS NULL) or filled (band_id set). Open slots
// are the thing `band-for-gig-slot` requests solicit applications for.

export const gigStatusEnum = pgEnum('gig_status', ['draft', 'open', 'confirmed', 'cancelled']);

export const gigs = pgTable('gigs', {
  id: serial('id').primaryKey(),
  datetime: timestamp('datetime', { withTimezone: true }).notNull(),
  venue_id: integer('venue_id')
    .notNull()
    .references(() => venues.id, { onDelete: 'restrict' }),
  doors: text('doors'),
  organiser_user_id: integer('organiser_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: gigStatusEnum('status').notNull().default('draft'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gigSlots = pgTable(
  'gig_slots',
  {
    id: serial('id').primaryKey(),
    gig_id: integer('gig_id')
      .notNull()
      .references(() => gigs.id, { onDelete: 'cascade' }),
    band_id: integer('band_id').references(() => bands.id, { onDelete: 'set null' }),
    set_order: integer('set_order').notNull(),
    fee: integer('fee'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('gig_slots_gig_id_set_order_uq').on(table.gig_id, table.set_order)],
);

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

export type PromoterPromoterGroup = typeof promotersPromoterGroups.$inferSelect;
export type PromoterGroupVenue = typeof promoterGroupsVenues.$inferSelect;
export type EngineerRecordingStudio = typeof engineersRecordingStudios.$inferSelect;
export type EngineerLiveAudioGroup = typeof engineersLiveAudioGroups.$inferSelect;

export type Rehearsal = typeof rehearsals.$inferSelect;

export type Gig = typeof gigs.$inferSelect;
export type GigSlot = typeof gigSlots.$inferSelect;
export type GigStatus = (typeof gigStatusEnum.enumValues)[number];

// --- Requests + Expressions of Interest (MUS-50) ---
//
// `requests` is a polymorphic table: each row represents an opportunity/ask
// posted by a user (e.g. a band looking for a drummer). The `kind` column
// discriminates the shape of `details`. Only `'musician-for-band'` is
// implemented now; more kinds (`'band-for-gig'`, `'musician-for-gig'`, etc.)
// land in MUS-56 / MUS-58, so `RequestDetails` is modelled as a discriminated
// union even though the union currently has a single branch.
//
// `expressions_of_interest` are per-target user responses against a request.
// `state` moves pending → accepted / rejected / withdrawn / auto_rejected.
// `auto_rejected` is for EoIs closed out by MUS-52 when `slots_filled` hits
// `slot_count`. Any `bandMembers` side-effects live in MUS-52, not here.

export const requestKindEnum = pgEnum('request_kind', [
  'musician-for-band',
  'band-for-gig-slot',
  'gig-for-band',
]);

export const requestStatusEnum = pgEnum('request_status', ['open', 'closed', 'cancelled']);

export const eoiStateEnum = pgEnum('eoi_state', [
  'pending',
  'accepted',
  'rejected',
  'withdrawn',
  'auto_rejected',
]);

// Discriminated union keyed on `kind`. Each branch mirrors the shape of its
// matching request_kind enum value. When we add new kinds (musician-for-gig,
// etc.) they land here as additional branches.
export type RequestDetails =
  | {
      kind: 'musician-for-band';
      instrument: string;
      style?: string;
      rehearsalCommitment?: string;
    }
  | {
      kind: 'band-for-gig-slot';
      gigId: number;
      setLength?: number;
      feeOffered?: number;
    }
  // `gig-for-band` (MUS-57): a band broadcasts that it's looking for a gig on
  // a specific date. No anchor object on the request side — the gig is
  // supplied by the promoter on the EoI (below). Single date only for this
  // slice; date ranges are a documented follow-up.
  | {
      kind: 'gig-for-band';
      bandId: number;
      targetDate: string; // ISO yyyy-mm-dd, no time component
      area?: string;
      feeAsked?: number;
    };

export type EoiDetails =
  | { kind: 'musician-for-band'; notes?: string }
  | { kind: 'band-for-gig-slot'; bandId: number }
  // `gig-for-band` EoI (MUS-57): a promoter expresses interest in the band by
  // offering one of their existing gigs. Acceptance slots the band into an
  // open `gig_slots` row on that gig. `bandForGigSlotRequestId` is optional
  // and captures the two-sided-same-engagement link when present.
  | {
      kind: 'gig-for-band';
      gigId: number;
      bandForGigSlotRequestId?: number;
      proposedFee?: number;
    };

export const requests = pgTable('requests', {
  id: serial('id').primaryKey(),
  kind: requestKindEnum('kind').notNull(),
  source_user_id: integer('source_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Anchor columns: exactly one is set depending on `kind`. `band-for-gig-slot`
  // anchors to a gig; `musician-for-band` anchors to a band. Keeping them as
  // independent nullable FKs (rather than a single polymorphic anchor_id +
  // anchor_type pattern) keeps FK integrity and lets us query/join naturally.
  anchor_band_id: integer('anchor_band_id').references(() => bands.id, { onDelete: 'cascade' }),
  anchor_gig_id: integer('anchor_gig_id').references(() => gigs.id, { onDelete: 'cascade' }),
  details: jsonb('details').$type<RequestDetails>().notNull(),
  slot_count: integer('slot_count').notNull().default(1),
  slots_filled: integer('slots_filled').notNull().default(0),
  status: requestStatusEnum('status').notNull().default('open'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const expressionsOfInterest = pgTable('expressions_of_interest', {
  id: serial('id').primaryKey(),
  request_id: integer('request_id')
    .notNull()
    .references(() => requests.id, { onDelete: 'cascade' }),
  target_user_id: integer('target_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  details: jsonb('details').$type<EoiDetails>(),
  state: eoiStateEnum('state').notNull().default('pending'),
  decided_at: timestamp('decided_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Request = typeof requests.$inferSelect;
export type ExpressionOfInterest = typeof expressionsOfInterest.$inferSelect;
export type RequestKind = (typeof requestKindEnum.enumValues)[number];
export type RequestStatus = (typeof requestStatusEnum.enumValues)[number];
export type EoiState = (typeof eoiStateEnum.enumValues)[number];

export interface BandWithMembers extends Band {
  members: Pick<User, 'id' | 'username' | 'firstName' | 'lastName'>[];
}

export interface BandProfile extends BandWithMembers {
  tracks: Pick<BandTrack, 'id' | 'title' | 'url' | 'position'>[];
}
