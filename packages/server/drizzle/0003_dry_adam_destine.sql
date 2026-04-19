CREATE TYPE "public"."eoi_state" AS ENUM('pending', 'accepted', 'rejected', 'withdrawn', 'auto_rejected');--> statement-breakpoint
CREATE TYPE "public"."request_kind" AS ENUM('musician-for-band');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('open', 'closed', 'cancelled');--> statement-breakpoint
CREATE TABLE "expressions_of_interest" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"target_user_id" integer NOT NULL,
	"details" jsonb,
	"state" "eoi_state" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "request_kind" NOT NULL,
	"source_user_id" integer NOT NULL,
	"anchor_band_id" integer,
	"details" jsonb NOT NULL,
	"slot_count" integer DEFAULT 1 NOT NULL,
	"slots_filled" integer DEFAULT 0 NOT NULL,
	"status" "request_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expressions_of_interest" ADD CONSTRAINT "expressions_of_interest_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expressions_of_interest" ADD CONSTRAINT "expressions_of_interest_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_source_user_id_users_id_fk" FOREIGN KEY ("source_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_anchor_band_id_bands_id_fk" FOREIGN KEY ("anchor_band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;