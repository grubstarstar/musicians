import {
  boolean,
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
  // MUS-86: multi-role set carried on the user row. Free text for now (see
  // ticket — enum validation is deliberately out of scope until abuse
  // appears). Defaults to '{}' so existing rows need no data migration. The
  // auth token payload and tRPC `ctx.user.roles` are wired from this column.
  roles: text('roles').array().notNull().default([]),
});

export const bands = pgTable('bands', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  imageUrl: text('imageUrl'),
  // MUS-92: identifies the user who created the band via the name-first
  // create flow (or future create paths). Nullable so legacy / seed-inserted
  // rows that pre-date this column don't need backfill, and `ON DELETE SET
  // NULL` so deleting the user doesn't cascade-drop the band. The mobile
  // band profile screen uses this to gate the "Add members" CTA — only the
  // creator sees it.
  created_by_user_id: integer('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
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
  // MUS-92: identifies the user who created the promoter group via the
  // name-first create flow. Nullable + `ON DELETE SET NULL` for the same
  // reasons as `bands.created_by_user_id` — legacy seed rows have no creator
  // and a user delete should not orphan the group.
  created_by_user_id: integer('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
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
  'night-at-venue',
  'promoter-for-venue-night',
  'band-for-musician',
  // `band_join` (MUS-87): a user (typically from the onboarding "Join existing
  // band" branch) asks to join a specific band. Anchor is the target band.
  // Accept is authorised for any existing member of that band and inserts a
  // `band_members` row for the requester.
  'band_join',
  // `promoter_group_join` (MUS-88): mirror of `band_join` for promoter groups.
  // Used by the onboarding "Join existing promoter group" branch. No anchor
  // column on `requests` for promoter groups, so the target group id is
  // carried in `details.promoterGroupId`. Accept is authorised for any
  // existing member of the group and inserts a `promoters_promoter_groups`
  // row for the requester (creating a `user_roles` row with role='promoter'
  // first if they don't already have one).
  'promoter_group_join',
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
      // MUS-68: instrument resolved against the `instruments` taxonomy. Stored
      // by id; the sibling-close invariant and match rule compare id equality.
      // Unresolved free-text inputs land on the canonical "Other" row.
      instrumentId: number;
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
    }
  // `night-at-venue` (MUS-58): a promoter broadcasts a concept for a night and
  // a set of dates they could run it on. No anchor object on the request side
  // — the venue is supplied by the venue rep on the EoI, and acceptance
  // creates a draft `gigs` row from the EoI payload.
  | {
      kind: 'night-at-venue';
      concept: string;
      possibleDates: string[]; // ISO yyyy-mm-dd list, non-empty
    }
  // `promoter-for-venue-night` (MUS-58): a venue rep has a specific night and
  // is looking for a promoter to run it. No anchor object — the gig is
  // created from the request payload when a promoter accepts.
  | {
      kind: 'promoter-for-venue-night';
      venueId: number;
      proposedDate: string; // ISO yyyy-mm-dd
      concept?: string;
    }
  // `band-for-musician` (MUS-58): a musician broadcasts that they're looking
  // for a band. Anchor sits on the EoI side — a specific band the accepting
  // user is a member of. Acceptance adds the musician to that band.
  | {
      kind: 'band-for-musician';
      // MUS-68: see note on `musician-for-band` above.
      instrumentId: number;
      availability?: string;
      demosUrl?: string;
    }
  // `band_join` (MUS-87): a user asks to join a specific band. `bandId` is
  // the target band (also carried on the anchor column for join ergonomics).
  // Accept/reject goes through dedicated `requests.respondToBandJoin` rather
  // than the EoI machinery — any existing member of the target band is
  // authorised to decide.
  | {
      kind: 'band_join';
      bandId: number;
    }
  // `promoter_group_join` (MUS-88): a user asks to join a specific promoter
  // group. Unlike `band_join` there is no anchor column for promoter groups
  // on the `requests` table, so `promoterGroupId` is only carried in details.
  // Accept/reject goes through dedicated `requests.respondToPromoterGroupJoin`
  // — any existing member of the target group can decide.
  | {
      kind: 'promoter_group_join';
      promoterGroupId: number;
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
    }
  // `night-at-venue` EoI (MUS-58): a venue rep picks one of the promoter's
  // `possibleDates` and pairs it with a venue they represent. Acceptance
  // creates a draft gig from this payload.
  | {
      kind: 'night-at-venue';
      venueId: number;
      proposedDate: string; // ISO yyyy-mm-dd (must be one of the request's possibleDates)
      concept?: string;
    }
  // `promoter-for-venue-night` EoI (MUS-58): a promoter accepts the venue's
  // proposed night. No new venue/date info — it all comes from the request.
  | {
      kind: 'promoter-for-venue-night';
      concept?: string;
    }
  // `band-for-musician` EoI (MUS-58): a band member offers one of their bands
  // to the musician. Acceptance inserts a `band_members` row (idempotent).
  // `instrumentRole` is the instrument they expect the musician to play; if
  // absent the match defaults to the request's `details.instrument`.
  | {
      kind: 'band-for-musician';
      bandId: number;
      instrumentRole?: string;
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

// --- Instruments taxonomy (MUS-68) ---
//
// Controlled vocabulary for the `musician-for-band` / `band-for-musician`
// request kinds. Kept as a table (not a pgEnum) so new instruments can be
// added by seed/admin without a schema migration per entry. `name` is unique
// — the seed is the authoritative source. `category` is a free-text string
// (strings / percussion / wind / brass / electronic / voice) so new
// categories don't require migrations either. A canonical "Other" row is
// seeded and serves as the fallback for free-text inputs the server can't
// resolve against the taxonomy — avoids a nullable `instrumentId`.
export const instruments = pgTable('instruments', {
  id: serial('id').primaryKey(),
  name: text('name').unique().notNull(),
  category: text('category'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Instrument = typeof instruments.$inferSelect;

// --- Musician profiles (MUS-85) ---
//
// 1:1 with `users` — the PK is `user_id`, and the FK cascades on user delete
// so a profile never outlives its user. This table stores the per-user
// musician-facing data that is independent of any Act/Band membership:
//   - a solo artist has a profile and a 1-member act
//   - a band member has a profile and `band_members` rows
//   - a session musician (MUS-84 "session musician" branch) has only a
//     profile — no act membership
//
// Every field except `available_for_session_work` is nullable so a freshly
// onboarded musician can upsert progressively. `instruments` is an
// unconstrained text[]; MUS-85 explicitly leaves validation against a
// canonical instrument list out of scope (handled later). `location` is
// free-form text; geocoding is out of scope for this slice.
export const musicianProfiles = pgTable('musician_profiles', {
  user_id: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  instruments: text('instruments').array().notNull().default([]),
  experience_years: integer('experience_years'),
  location: text('location'),
  bio: text('bio'),
  available_for_session_work: boolean('available_for_session_work').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MusicianProfile = typeof musicianProfiles.$inferSelect;

// Camel-case DTO shape returned by `bands.list` and `bands.listMine` (mobile)
// and the `/api/bands` REST endpoint (web). Independent of the raw `Band` row
// type so the snake_case `created_by_user_id` column doesn't leak to clients
// — that column is intentionally NOT exposed on the list shapes (it's only
// surfaced on `BandProfile`, where the mobile profile screen needs it for the
// "Add members" CTA gate).
export interface BandWithMembers {
  id: number;
  name: string;
  imageUrl: string | null;
  members: Pick<User, 'id' | 'username' | 'firstName' | 'lastName'>[];
}

// `BandProfile` deliberately rewrites the `Band` shape in camelCase rather
// than extending it: the DB columns are `snake_case` but the tRPC response
// shape is `camelCase` (per the CLAUDE.md convention of explicit projections
// with camelCase keys). MUS-92 added `created_by_user_id` → `createdByUserId`
// here.
export interface BandProfile {
  id: number;
  name: string;
  imageUrl: string | null;
  createdByUserId: number | null;
  members: Pick<User, 'id' | 'username' | 'firstName' | 'lastName'>[];
  tracks: Pick<BandTrack, 'id' | 'title' | 'url' | 'position'>[];
}
