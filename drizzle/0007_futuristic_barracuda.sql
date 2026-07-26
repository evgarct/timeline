ALTER TABLE "products" ADD COLUMN "search_aliases" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "normalized_search_aliases" text;