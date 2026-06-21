-- Run this in Supabase SQL Editor
-- Adds English-language offer text fields for bilingual retention offers

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS retention_offer_text_en text,
  ADD COLUMN IF NOT EXISTS retention_offer_text_positive_en text;
