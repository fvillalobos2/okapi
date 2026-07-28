-- add_product_category_fields
--
-- product_categories was created with a minimal schema; extend it to support
-- AI prompt instructions, keyword matching, and agent/team assignment used by
-- the Acuarium cs-engine-legacy and the admin panel catalog section.

ALTER TABLE product_categories
  ADD COLUMN IF NOT EXISTS description        text,
  ADD COLUMN IF NOT EXISTS prompt_instructions text,
  ADD COLUMN IF NOT EXISTS product_keywords   text[],
  ADD COLUMN IF NOT EXISTS assigned_team_id   uuid REFERENCES teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_user_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_url          text;
