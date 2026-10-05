ALTER TABLE "exercises" ADD COLUMN "primary_muscles" jsonb;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "secondary_muscles" jsonb;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "movement_pattern" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "equipment" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "rir" smallint;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "set_type" text DEFAULT 'working' NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "group_id" text;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "performed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "exercises" SET "primary_muscles" = "muscle_groups" WHERE "muscle_groups" IS NOT NULL;--> statement-breakpoint
DELETE FROM "workout_sets" WHERE "event_id" NOT IN (SELECT "id" FROM "events");--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;