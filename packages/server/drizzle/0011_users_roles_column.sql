-- MUS-86: add `roles text[] NOT NULL DEFAULT '{}'` to users.
--
-- Onboarding (MUS-84) needs every user to carry one or more roles (musician,
-- promoter today; recording engineer and others later). Storing the set on
-- the user row from day one makes the future add-role-later action a zero-
-- migration change. Free-text for now; enum validation is intentionally
-- deferred until abuse appears.
--
-- Existing users default to an empty array, which is the DB-level contract
-- the integration test asserts. The default also means rows inserted via
-- the existing seed paths continue to work without code churn.

ALTER TABLE "users" ADD COLUMN "roles" text[] DEFAULT '{}' NOT NULL;
