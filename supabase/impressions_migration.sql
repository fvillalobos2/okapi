CREATE TABLE IF NOT EXISTS impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  staff_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS impressions_restaurant_id_idx ON impressions (restaurant_id);
CREATE INDEX IF NOT EXISTS impressions_created_at_idx ON impressions (created_at);

ALTER TABLE impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON impressions
  USING (true) WITH CHECK (true);
