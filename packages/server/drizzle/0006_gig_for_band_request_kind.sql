-- MUS-57: extend request_kind enum with 'gig-for-band' (bands broadcasting
-- they want a gig). No schema changes beyond the enum: request details are
-- stored in `requests.details` JSONB and the anchor sits on the EoI side, so
-- no new columns are required.

ALTER TYPE "public"."request_kind" ADD VALUE 'gig-for-band';
