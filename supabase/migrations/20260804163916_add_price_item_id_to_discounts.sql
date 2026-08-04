ALTER TABLE discounts
  ADD COLUMN IF NOT EXISTS price_item_id uuid REFERENCES price_items(id) ON DELETE SET NULL;
