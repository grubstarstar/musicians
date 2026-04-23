-- MUS-88: extend request_kind enum with the new `promoter_group_join` kind
-- used by the onboarding "Join existing promoter group" branch. A user asks to
-- join a specific promoter group; any existing member of that group can accept,
-- which inserts a `promoters_promoter_groups` row for the requester (and a
-- `user_roles` row with role='promoter' if the requester doesn't already have
-- one).
--
-- Hand-written per the CLAUDE.md gotcha about `pnpm db:generate` being
-- interactive. No schema changes beyond the enum — accept/reject uses the
-- existing `requests` table, acceptance writes to the existing
-- `promoters_promoter_groups` and `user_roles` tables.

ALTER TYPE "public"."request_kind" ADD VALUE 'promoter_group_join';
