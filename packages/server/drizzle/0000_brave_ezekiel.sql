CREATE TABLE "band_members" (
	"band_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "band_members_band_id_user_id_pk" PRIMARY KEY("band_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "band_tracks" (
	"id" serial PRIMARY KEY NOT NULL,
	"band_id" integer NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bands" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"imageUrl" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"firstName" text,
	"lastName" text,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "band_members" ADD CONSTRAINT "band_members_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "band_members" ADD CONSTRAINT "band_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "band_tracks" ADD CONSTRAINT "band_tracks_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE cascade ON UPDATE no action;