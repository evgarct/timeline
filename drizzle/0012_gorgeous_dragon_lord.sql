CREATE TABLE "workout_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"note" text,
	"exercises" jsonb NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workout_templates_user_id_id_idx" ON "workout_templates" USING btree ("user_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_templates_user_name_idx" ON "workout_templates" USING btree ("user_id","normalized_name");