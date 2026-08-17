CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"custo_fixo_total" double precision DEFAULT 0 NOT NULL,
	"produtos" jsonb NOT NULL,
	"custos_fixos" jsonb NOT NULL,
	"label" text
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "imposto" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "taxa_cartao" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "comissao" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "margem" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "preco_ideal" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "preco_fixo" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "percentual_rateio" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "modo_precificacao" text DEFAULT 'margem';--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;