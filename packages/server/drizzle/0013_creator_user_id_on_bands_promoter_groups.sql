-- MUS-92: track the creator of a band / promoter group on the entity itself.
--
-- The name-first create flow (parent epic MUS-84) needs to know which user
-- created an entity so the resulting profile can show an "Add members" CTA
-- only to that user. Storing the FK on the entity row is cheaper than
-- joining through `band_members` / `promoters_promoter_groups` to find a
-- "first member" and is robust to membership churn (the original creator
-- leaving the band shouldn't transfer creator status).
--
-- Both columns are nullable + `ON DELETE SET NULL`:
--   - nullable so existing seed-inserted rows don't need backfill (`bands`
--     and `promoter_groups` were both seeded before this column existed);
--   - `SET NULL` so a user deletion does not cascade-drop bands/promoter
--     groups they happened to create.
--
-- Hand-written per the CLAUDE.md "Drizzle-kit `generate` is interactive"
-- gotcha — column-add only, no rename ambiguity, so the SQL is minimal.

ALTER TABLE "bands"
  ADD COLUMN "created_by_user_id" integer;

ALTER TABLE "bands"
  ADD CONSTRAINT "bands_created_by_user_id_users_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "promoter_groups"
  ADD COLUMN "created_by_user_id" integer;

ALTER TABLE "promoter_groups"
  ADD CONSTRAINT "promoter_groups_created_by_user_id_users_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
