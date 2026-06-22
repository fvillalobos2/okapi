-- Add custom_categories to restaurants table
-- Stores bilingual category lists as {es: string[], en: string[]}
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS custom_categories jsonb;
