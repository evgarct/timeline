ALTER TYPE "public"."event_type" ADD VALUE 'nutrition_entry';--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"brand" text,
	"normalized_brand" text,
	"barcode" text,
	"base_unit" text NOT NULL,
	"nutrient_bases" jsonb NOT NULL,
	"piece_sizes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "products_user_id_id_idx" ON "products" USING btree ("user_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_user_id_barcode_idx" ON "products" USING btree ("user_id","barcode");--> statement-breakpoint
CREATE UNIQUE INDEX "events_user_id_idempotency_key_idx" ON "events" USING btree ("user_id","idempotency_key");