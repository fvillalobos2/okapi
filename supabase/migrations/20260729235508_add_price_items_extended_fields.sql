-- add_price_items_extended_fields
--
-- Adds fields used by the panel API routes and AI catalog:
-- model_code, prompt_snippet, product_keywords, currency, image_url, team/user assignment.
-- Also adds tax_rate + price_includes_tax for IVA display in the panel.

ALTER TABLE price_items
  ADD COLUMN IF NOT EXISTS model_code          text,
  ADD COLUMN IF NOT EXISTS prompt_snippet      text,
  ADD COLUMN IF NOT EXISTS product_keywords    text[],
  ADD COLUMN IF NOT EXISTS currency            text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS image_url           text,
  ADD COLUMN IF NOT EXISTS assigned_team_id    uuid REFERENCES teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price_includes_tax  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_rate            numeric(5,2) DEFAULT 13;
