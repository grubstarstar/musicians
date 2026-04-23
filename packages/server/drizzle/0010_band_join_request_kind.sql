-- MUS-87: extend request_kind enum with the new `band_join` kind used by the
-- onboarding "Join existing band" branch. A user asks to join a specific band;
-- any existing member of that band can accept, which inserts a `band_members`
-- row for the requester.
--
-- Hand-written per the CLAUDE.md gotcha about `pnpm db:generate` being
-- interactive. No schema changes beyond the enum — accept/reject uses the
-- existing `requests` table, acceptance writes to the existing `band_members`
-- table.

ALTER TYPE "public"."request_kind" ADD VALUE 'band_join';
