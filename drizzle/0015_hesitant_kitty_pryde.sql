CREATE TABLE "agent_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"severity" text,
	"tool" text,
	"summary" text NOT NULL,
	"details" text,
	"expected" text,
	"suggestion" text,
	"tool_calls" jsonb,
	"source" text NOT NULL,
	"client" text,
	"page" text,
	"status" text DEFAULT 'new' NOT NULL,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_feedback_user_id_id_idx" ON "agent_feedback" USING btree ("user_id","id");--> statement-breakpoint
CREATE INDEX "agent_feedback_user_status_created_idx" ON "agent_feedback" USING btree ("user_id","status","created_at");