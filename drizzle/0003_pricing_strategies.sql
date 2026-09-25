CREATE TABLE IF NOT EXISTS "pricing_strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"margem" double precision DEFAULT 0 NOT NULL,
	"cor" text DEFAULT 'slate' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "estrategia_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pricing_strategies" ADD CONSTRAINT "pricing_strategies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pricing_strategies" ADD CONSTRAINT "pricing_strategies_user_name_key" UNIQUE("user_id","name");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pricing_strategies_user_idx" ON "pricing_strategies" USING btree ("user_id");
