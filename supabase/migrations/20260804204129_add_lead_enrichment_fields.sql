ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_enriched jsonb DEFAULT '{}'::jsonb;
