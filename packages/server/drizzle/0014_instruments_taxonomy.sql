-- MUS-68: instruments taxonomy + backfill of `requests.details`.
--
-- Introduces the `instruments` table (controlled vocabulary) and migrates
-- existing `requests.details.instrument` string values into new
-- `requests.details.instrumentId` integer values. Unresolved strings fall
-- back to the canonical 'Other' row, which is seeded as part of this
-- migration so the backfill is atomic — no `instrumentId = null` rows.
--
-- The seed list insert is idempotent via `ON CONFLICT DO NOTHING` on the
-- unique name constraint, so re-running the full migrate doesn't create
-- duplicates. The application's `seed.ts` also upserts on startup; both
-- paths converge on the same canonical row set.
--
-- Rationale for the "Other" row rather than nullable `instrumentId`:
--   - keeps the match rule and sibling-close invariant as strict id
--     equality (no "one side is null" special case), and
--   - preserves the free-text input on screen without forcing a new
--     `instrumentHint` column every client has to render.

CREATE TABLE "instruments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instruments_name_unique" UNIQUE("name")
);
--> statement-breakpoint

-- Canonical seed. Keep in sync with `packages/server/src/instruments-seed.ts`
-- — that module is the runtime source of truth and imports the list into
-- both the migration-time backfill (this file) and the ongoing
-- `pnpm seed` idempotent path.
INSERT INTO "instruments" ("name", "category") VALUES
('Guitar', 'strings'),
('Acoustic Guitar', 'strings'),
('Electric Guitar', 'strings'),
('Classical Guitar', 'strings'),
('12-String Guitar', 'strings'),
('Bass Guitar', 'strings'),
('Double Bass', 'strings'),
('Violin', 'strings'),
('Viola', 'strings'),
('Cello', 'strings'),
('Banjo', 'strings'),
('Mandolin', 'strings'),
('Ukulele', 'strings'),
('Harp', 'strings'),
('Lap Steel Guitar', 'strings'),
('Pedal Steel Guitar', 'strings'),
('Dobro', 'strings'),
('Resonator Guitar', 'strings'),
('Sitar', 'strings'),
('Bouzouki', 'strings'),
('Balalaika', 'strings'),
('Oud', 'strings'),
('Lute', 'strings'),
('Harpsichord', 'strings'),
('Hammered Dulcimer', 'strings'),
('Appalachian Dulcimer', 'strings'),
('Autoharp', 'strings'),
('Charango', 'strings'),
('Erhu', 'strings'),
('Koto', 'strings'),
('Shamisen', 'strings'),
('Saz', 'strings'),
('Pipa', 'strings'),
('Nyckelharpa', 'strings'),
('Piano', 'keyboards'),
('Keyboard', 'keyboards'),
('Electric Piano', 'keyboards'),
('Synthesizer', 'keyboards'),
('Organ', 'keyboards'),
('Hammond Organ', 'keyboards'),
('Pipe Organ', 'keyboards'),
('Accordion', 'keyboards'),
('Melodica', 'keyboards'),
('Rhodes', 'keyboards'),
('Wurlitzer', 'keyboards'),
('Mellotron', 'keyboards'),
('Clavinet', 'keyboards'),
('Harmonium', 'keyboards'),
('Drums', 'percussion'),
('Snare Drum', 'percussion'),
('Bass Drum', 'percussion'),
('Bongos', 'percussion'),
('Congas', 'percussion'),
('Cajón', 'percussion'),
('Djembe', 'percussion'),
('Tambourine', 'percussion'),
('Cymbals', 'percussion'),
('Hi-Hat', 'percussion'),
('Ride Cymbal', 'percussion'),
('Crash Cymbal', 'percussion'),
('Timpani', 'percussion'),
('Xylophone', 'percussion'),
('Marimba', 'percussion'),
('Vibraphone', 'percussion'),
('Glockenspiel', 'percussion'),
('Triangle', 'percussion'),
('Cowbell', 'percussion'),
('Maracas', 'percussion'),
('Shaker', 'percussion'),
('Claves', 'percussion'),
('Castanets', 'percussion'),
('Tabla', 'percussion'),
('Darbuka', 'percussion'),
('Frame Drum', 'percussion'),
('Bodhrán', 'percussion'),
('Wood Block', 'percussion'),
('Steel Pan', 'percussion'),
('Hang Drum', 'percussion'),
('Udu', 'percussion'),
('Taiko', 'percussion'),
('Saxophone', 'wind'),
('Alto Saxophone', 'wind'),
('Tenor Saxophone', 'wind'),
('Soprano Saxophone', 'wind'),
('Baritone Saxophone', 'wind'),
('Flute', 'wind'),
('Piccolo', 'wind'),
('Clarinet', 'wind'),
('Bass Clarinet', 'wind'),
('Oboe', 'wind'),
('English Horn', 'wind'),
('Bassoon', 'wind'),
('Contrabassoon', 'wind'),
('Recorder', 'wind'),
('Tin Whistle', 'wind'),
('Harmonica', 'wind'),
('Bagpipes', 'wind'),
('Didgeridoo', 'wind'),
('Pan Flute', 'wind'),
('Ocarina', 'wind'),
('Shakuhachi', 'wind'),
('Duduk', 'wind'),
('Kaval', 'wind'),
('Launeddas', 'wind'),
('Trumpet', 'brass'),
('Cornet', 'brass'),
('Flugelhorn', 'brass'),
('Trombone', 'brass'),
('Bass Trombone', 'brass'),
('French Horn', 'brass'),
('Tuba', 'brass'),
('Euphonium', 'brass'),
('Sousaphone', 'brass'),
('Baritone Horn', 'brass'),
('Mellophone', 'brass'),
('Bugle', 'brass'),
('Alphorn', 'brass'),
('Shofar', 'brass'),
('Vocals', 'voice'),
('Lead Vocals', 'voice'),
('Backing Vocals', 'voice'),
('Soprano', 'voice'),
('Mezzo-Soprano', 'voice'),
('Alto', 'voice'),
('Tenor', 'voice'),
('Baritone', 'voice'),
('Bass', 'voice'),
('Beatbox', 'voice'),
('Rap', 'voice'),
('MC', 'voice'),
('Spoken Word', 'voice'),
('Throat Singing', 'voice'),
('Yodel', 'voice'),
('DJ', 'electronic'),
('Turntables', 'electronic'),
('Sampler', 'electronic'),
('Drum Machine', 'electronic'),
('Modular Synthesizer', 'electronic'),
('Analog Synthesizer', 'electronic'),
('Digital Synthesizer', 'electronic'),
('Sequencer', 'electronic'),
('Launchpad', 'electronic'),
('MPC', 'electronic'),
('Theremin', 'electronic'),
('Vocoder', 'electronic'),
('Talkbox', 'electronic'),
('Laptop', 'electronic'),
('Ableton Live', 'electronic'),
('Loop Station', 'electronic'),
('Granular Synth', 'electronic'),
('Other', NULL)
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint

-- Backfill `requests.details` for the two instrument-carrying kinds.
-- Strategy:
--   1. For each matching row, look up the `instruments` id via a
--      case-insensitive trimmed name match.
--   2. If that lookup yields a row, patch the details JSONB to swap
--      `instrument` (string) for `instrumentId` (integer). Otherwise
--      point the row at the canonical 'Other' row.
--   3. Drop the legacy `instrument` key in the same `jsonb_set` call so
--      there's no stale state left behind.
-- Filter purely on the JSON shape (`details ? 'instrument'`) rather than
-- `kind IN ('musician-for-band', 'band-for-musician')` — Postgres forbids
-- using an enum value inside the same transaction that introduced it, and a
-- fresh-DB migrate runs every migration in one transaction, so the
-- `kind` filter would fail the rebuild. The JSON key only exists on those
-- two kinds by shape invariant (nothing else writes `instrument` into
-- `details`), so the filters are functionally equivalent.
UPDATE "requests" r
SET "details" = jsonb_set(
    (r."details" - 'instrument'),
    '{instrumentId}',
    to_jsonb(COALESCE(
        (
            SELECT i."id"
            FROM "instruments" i
            WHERE lower(trim(i."name")) = lower(trim(r."details" ->> 'instrument'))
            LIMIT 1
        ),
        (SELECT "id" FROM "instruments" WHERE "name" = 'Other' LIMIT 1)
    ))
)
WHERE r."details" ? 'instrument';
