-- MUS-67: drop the dead `musicians_bands` table.
--
-- The table was the original user_role-indexed band membership join; every
-- current caller uses the simpler `band_members` table instead (see MUS-52
-- acceptance flow, `bands/queries.ts`, `bandRoutes.ts`, seed, MUS-63's
-- `listMyBands`). It has zero runtime references and is not seeded.
--
-- FKs: `musicians_bands` holds a FK to `user_roles` but is not targeted by
-- any inbound FK, so `DROP TABLE` alone is sufficient. The unique index
-- `musicians_bands_user_role_id_band_id_uq` drops automatically with it.

DROP TABLE "musicians_bands";
