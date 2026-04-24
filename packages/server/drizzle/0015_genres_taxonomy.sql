-- MUS-103: genres taxonomy + band_genres join + gig_slots.genre_id.
--
-- Introduces the `genres` controlled vocabulary and wires it to:
--   - `band_genres` (new M2M join; composite PK on (band_id, genre_id);
--     cascades on band delete, restricts on genre delete so admins can't
--     accidentally nuke band-side metadata by retiring a taxonomy entry)
--   - `gig_slots.genre_id` (new nullable FK; SET NULL on genre delete — if
--     a genre is ever retired the slot is kept and the filter quietly drops)
--
-- The seed list insert is idempotent via `ON CONFLICT DO NOTHING` on the
-- unique slug constraint, so re-running the migration (or `pnpm seed`)
-- converges on the same canonical row set. Keep this list in sync with
-- `packages/server/src/genres-seed.ts` — that module is the runtime source
-- of truth.
--
-- No retroactive backfill: existing `band-for-gig-slot` requests keep their
-- open-to-all behaviour (details.genreId is simply unset, and the EoI
-- hard-gate accepts when it's null/unset).

CREATE TABLE "genres" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "genres_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

CREATE TABLE "band_genres" (
	"band_id" integer NOT NULL,
	"genre_id" integer NOT NULL,
	CONSTRAINT "band_genres_band_id_genre_id_pk" PRIMARY KEY("band_id","genre_id")
);
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "band_genres" ADD CONSTRAINT "band_genres_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "band_genres" ADD CONSTRAINT "band_genres_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

ALTER TABLE "gig_slots" ADD COLUMN "genre_id" integer;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "gig_slots" ADD CONSTRAINT "gig_slots_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Canonical seed. Keep in sync with `packages/server/src/genres-seed.ts`.
INSERT INTO "genres" ("slug", "name", "sort_order") VALUES
('rock', 'Rock', 10),
('pop', 'Pop', 20),
('jazz', 'Jazz', 30),
('folk', 'Folk', 40),
('punk', 'Punk', 50),
('electronic', 'Electronic', 60),
('hip-hop', 'Hip-Hop', 70),
('classical', 'Classical', 80),
('country', 'Country', 90),
('metal', 'Metal', 100)
ON CONFLICT ("slug") DO NOTHING;
