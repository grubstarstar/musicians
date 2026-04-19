-- MUS-58: extend request_kind enum with the three remaining counterpart
-- kinds that complete the MUS-44 Epic's kind table:
--   - 'night-at-venue'          (promoter -> venue rep)
--   - 'promoter-for-venue-night'(venue rep -> promoter, counterpart)
--   - 'band-for-musician'       (musician -> band, counterpart of musician-for-band)
--
-- No schema changes beyond the enum: request/EoI details are stored in the
-- `details` JSONB columns and the acceptance side-effects (gig creation,
-- band member insert) all go to existing tables.

ALTER TYPE "public"."request_kind" ADD VALUE 'night-at-venue';
--> statement-breakpoint
ALTER TYPE "public"."request_kind" ADD VALUE 'promoter-for-venue-night';
--> statement-breakpoint
ALTER TYPE "public"."request_kind" ADD VALUE 'band-for-musician';
