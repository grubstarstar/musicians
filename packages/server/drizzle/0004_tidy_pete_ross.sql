-- MUS-56: events → rehearsals rename, drop event_kind, add gigs + gig_slots,
-- extend request_kind with 'band-for-gig-slot', add anchor_gig_id to requests.

-- Rename the `events` table to `rehearsals` and drop its `kind` column. We
-- use ALTER TABLE RENAME so existing data survives the migration; this also
-- implicitly renames the table's sequence and PK constraint.
ALTER TABLE "events" RENAME TO "rehearsals";--> statement-breakpoint
ALTER TABLE "rehearsals" DROP COLUMN "kind";--> statement-breakpoint
DROP TYPE "public"."event_kind";--> statement-breakpoint

-- Gigs + slots.
CREATE TYPE "public"."gig_status" AS ENUM('draft', 'open', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TABLE "gigs" (
	"id" serial PRIMARY KEY NOT NULL,
	"datetime" timestamp with time zone NOT NULL,
	"venue_id" integer NOT NULL,
	"doors" text,
	"organiser_user_id" integer NOT NULL,
	"status" "gig_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gig_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"gig_id" integer NOT NULL,
	"band_id" integer,
	"set_order" integer NOT NULL,
	"fee" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gigs" ADD CONSTRAINT "gigs_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gigs" ADD CONSTRAINT "gigs_organiser_user_id_users_id_fk" FOREIGN KEY ("organiser_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_slots" ADD CONSTRAINT "gig_slots_gig_id_gigs_id_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."gigs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_slots" ADD CONSTRAINT "gig_slots_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gig_slots_gig_id_set_order_uq" ON "gig_slots" USING btree ("gig_id","set_order");--> statement-breakpoint

-- Extend request_kind enum with the new branch.
ALTER TYPE "public"."request_kind" ADD VALUE 'band-for-gig-slot';--> statement-breakpoint

-- Add anchor_gig_id nullable FK to requests.
ALTER TABLE "requests" ADD COLUMN "anchor_gig_id" integer;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_anchor_gig_id_gigs_id_fk" FOREIGN KEY ("anchor_gig_id") REFERENCES "public"."gigs"("id") ON DELETE cascade ON UPDATE no action;
