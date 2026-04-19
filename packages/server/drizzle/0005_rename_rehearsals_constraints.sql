-- MUS-59: cosmetic cleanup after the MUS-56 events → rehearsals rename.
-- Postgres' ALTER TABLE RENAME TO preserves the underlying index and FK
-- identifier names. Bring them in line with the new table name so psql
-- inspections and future migration errors match the logical schema.

ALTER INDEX "events_pkey" RENAME TO "rehearsals_pkey";
--> statement-breakpoint
ALTER TABLE "rehearsals" RENAME CONSTRAINT "events_band_id_bands_id_fk" TO "rehearsals_band_id_bands_id_fk";
--> statement-breakpoint
ALTER SEQUENCE "events_id_seq" RENAME TO "rehearsals_id_seq";
