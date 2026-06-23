CREATE TABLE "storage_policies" (
	"user_id" text PRIMARY KEY NOT NULL,
	"limit_bytes" integer,
	"plan" text DEFAULT 'default' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
