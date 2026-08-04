ALTER TABLE conversations ADD COLUMN IF NOT EXISTS business_line text;
CREATE INDEX IF NOT EXISTS conversations_business_line_idx ON conversations(business_id, business_line);
