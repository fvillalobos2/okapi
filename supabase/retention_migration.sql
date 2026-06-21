-- Run this in Supabase SQL Editor

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS retention_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retention_show_to text DEFAULT 'negative',
  ADD COLUMN IF NOT EXISTS retention_offer_text text,
  ADD COLUMN IF NOT EXISTS retention_valid_days int DEFAULT 14;

CREATE TABLE IF NOT EXISTS retention_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  code text NOT NULL,
  stars int,
  email text,
  redeemed boolean DEFAULT false,
  redeemed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS retention_codes_restaurant_id_idx ON retention_codes(restaurant_id);
