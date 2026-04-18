import { integer, pgTable, primaryKey, serial, text } from 'drizzle-orm/pg-core';

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

export type User = typeof users.$inferSelect;
export type Band = typeof bands.$inferSelect;
export type BandMember = typeof bandMembers.$inferSelect;
export type BandTrack = typeof bandTracks.$inferSelect;

export interface BandWithMembers extends Band {
  members: Pick<User, 'id' | 'username' | 'firstName' | 'lastName'>[];
}

export interface BandProfile extends BandWithMembers {
  tracks: Pick<BandTrack, 'id' | 'title' | 'url' | 'position'>[];
}
