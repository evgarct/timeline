CREATE TYPE "public"."media_kind" AS ENUM('progress_photo', 'inbody');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending', 'ready', 'deleting');--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_id" uuid,
	"kind" "media_kind" NOT NULL,
	"object_key" text NOT NULL,
	"thumbnail_object_key" text,
	"mime_type" text NOT NULL,
	"original_file_name" text NOT NULL,
	"width" integer,
	"height" integer,
	"size_bytes" integer NOT NULL,
	"thumbnail_size_bytes" integer,
	"status" "media_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "media_assets_thumbnail_object_key_unique" UNIQUE("thumbnail_object_key")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_user_id_id_idx" ON "media_assets" USING btree ("user_id","id");