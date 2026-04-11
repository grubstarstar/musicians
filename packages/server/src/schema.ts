import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').unique().notNull(),
  password_hash: text('password_hash').notNull(),
  firstName: text('firstName'),
  lastName: text('lastName'),
});

export const bands = sqliteTable('bands', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  imageUrl: text('imageUrl'),
});

export const bandTracks = sqliteTable('band_tracks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  band_id: integer('band_id').notNull().references(() => bands.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  url: text('url').notNull(),
  position: integer('position').notNull().default(0),
});

export const bandMembers = sqliteTable(
  'band_members',
  {
    band_id: integer('band_id')
      .notNull()
      .references(() => bands.id),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id),
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
