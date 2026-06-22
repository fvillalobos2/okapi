-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, code)
);

CREATE INDEX IF NOT EXISTS staff_members_restaurant_id_idx ON staff_members(restaurant_id);

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS staff_code text;
