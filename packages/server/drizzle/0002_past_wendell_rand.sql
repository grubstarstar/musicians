CREATE TYPE "public"."event_kind" AS ENUM('gig', 'rehearsal');--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"band_id" integer NOT NULL,
	"kind" "event_kind" NOT NULL,
	"datetime" timestamp with time zone NOT NULL,
	"venue" text NOT NULL,
	"doors" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;