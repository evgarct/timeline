CREATE TABLE "nutrition_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"report_date" text NOT NULL,
	"timezone" text NOT NULL,
	"pdf_object_key" text NOT NULL,
	"og_image_object_key" text NOT NULL,
	"pdf_size_bytes" integer NOT NULL,
	"og_image_size_bytes" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nutrition_reports_pdf_object_key_unique" UNIQUE("pdf_object_key"),
	CONSTRAINT "nutrition_reports_og_image_object_key_unique" UNIQUE("og_image_object_key")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "nutrition_reports_user_id_id_idx" ON "nutrition_reports" USING btree ("user_id","id");