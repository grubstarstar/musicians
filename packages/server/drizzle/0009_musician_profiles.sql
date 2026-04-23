-- MUS-85: add `musician_profiles` — the 1:1 companion table to `users` that
-- stores per-user musician-facing data (instruments, experience, location,
-- bio, session-work availability) independent of any Act/Band membership.
--
-- The PK is `user_id` and the FK to `users(id)` cascades on delete so a
-- profile never outlives its user. All fields except
-- `available_for_session_work` are nullable so a freshly onboarded musician
-- can upsert progressively. `instruments` is an unconstrained `text[]`;
-- validation against a canonical instrument list is explicitly out of scope.

CREATE TABLE "musician_profiles" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"instruments" text[] DEFAULT '{}' NOT NULL,
	"experience_years" integer,
	"location" text,
	"bio" text,
	"available_for_session_work" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "musician_profiles" ADD CONSTRAINT "musician_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
