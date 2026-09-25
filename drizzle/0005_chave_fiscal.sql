ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "chave_fiscal" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_user_chave_fiscal_idx" ON "products" USING btree ("user_id","chave_fiscal");
