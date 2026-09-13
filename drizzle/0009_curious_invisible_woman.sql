CREATE TABLE "daily_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"activity_date" text NOT NULL,
	"timezone" text NOT NULL,
	"steps" integer NOT NULL,
	"goal_steps" integer NOT NULL,
	"distance_meters" integer,
	"weekly_average" integer,
	"workout_count" integer DEFAULT 0 NOT NULL,
	"workout_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "daily_activity_user_id_date_idx" ON "daily_activity" USING btree ("user_id","activity_date");