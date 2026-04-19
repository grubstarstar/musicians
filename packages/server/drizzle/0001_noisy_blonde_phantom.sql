CREATE TYPE "public"."user_role" AS ENUM('musician', 'promoter', 'engineer');--> statement-breakpoint
CREATE TABLE "engineers_live_audio_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_role_id" integer NOT NULL,
	"live_audio_group_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineers_recording_studios" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_role_id" integer NOT NULL,
	"recording_studio_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_audio_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "musicians_bands" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_role_id" integer NOT NULL,
	"band_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promoter_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promoter_groups_venues" (
	"id" serial PRIMARY KEY NOT NULL,
	"promoter_group_id" integer NOT NULL,
	"venue_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promoters_promoter_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_role_id" integer NOT NULL,
	"promoter_group_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recording_studios" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engineers_live_audio_groups" ADD CONSTRAINT "engineers_live_audio_groups_user_role_id_user_roles_id_fk" FOREIGN KEY ("user_role_id") REFERENCES "public"."user_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineers_live_audio_groups" ADD CONSTRAINT "engineers_live_audio_groups_live_audio_group_id_live_audio_groups_id_fk" FOREIGN KEY ("live_audio_group_id") REFERENCES "public"."live_audio_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineers_recording_studios" ADD CONSTRAINT "engineers_recording_studios_user_role_id_user_roles_id_fk" FOREIGN KEY ("user_role_id") REFERENCES "public"."user_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineers_recording_studios" ADD CONSTRAINT "engineers_recording_studios_recording_studio_id_recording_studios_id_fk" FOREIGN KEY ("recording_studio_id") REFERENCES "public"."recording_studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musicians_bands" ADD CONSTRAINT "musicians_bands_user_role_id_user_roles_id_fk" FOREIGN KEY ("user_role_id") REFERENCES "public"."user_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musicians_bands" ADD CONSTRAINT "musicians_bands_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoter_groups_venues" ADD CONSTRAINT "promoter_groups_venues_promoter_group_id_promoter_groups_id_fk" FOREIGN KEY ("promoter_group_id") REFERENCES "public"."promoter_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoter_groups_venues" ADD CONSTRAINT "promoter_groups_venues_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoters_promoter_groups" ADD CONSTRAINT "promoters_promoter_groups_user_role_id_user_roles_id_fk" FOREIGN KEY ("user_role_id") REFERENCES "public"."user_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoters_promoter_groups" ADD CONSTRAINT "promoters_promoter_groups_promoter_group_id_promoter_groups_id_fk" FOREIGN KEY ("promoter_group_id") REFERENCES "public"."promoter_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "engineers_live_audio_groups_user_role_id_group_id_uq" ON "engineers_live_audio_groups" USING btree ("user_role_id","live_audio_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "engineers_recording_studios_user_role_id_studio_id_uq" ON "engineers_recording_studios" USING btree ("user_role_id","recording_studio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "musicians_bands_user_role_id_band_id_uq" ON "musicians_bands" USING btree ("user_role_id","band_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promoter_groups_venues_group_id_venue_id_uq" ON "promoter_groups_venues" USING btree ("promoter_group_id","venue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promoters_promoter_groups_user_role_id_group_id_uq" ON "promoters_promoter_groups" USING btree ("user_role_id","promoter_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_user_id_role_uq" ON "user_roles" USING btree ("user_id","role");