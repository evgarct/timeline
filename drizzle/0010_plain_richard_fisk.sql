CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"muscle_groups" jsonb,
	"search_aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"normalized_search_aliases" text,
	"external_source" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"set_index" integer NOT NULL,
	"reps" integer,
	"weight_kg" numeric,
	"completed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_user_id_id_idx" ON "exercises" USING btree ("user_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_user_external_idx" ON "exercises" USING btree ("user_id","external_source","external_id");--> statement-breakpoint
CREATE INDEX "workout_sets_user_exercise_idx" ON "workout_sets" USING btree ("user_id","exercise_id","created_at");--> statement-breakpoint
CREATE INDEX "workout_sets_user_event_idx" ON "workout_sets" USING btree ("user_id","event_id");