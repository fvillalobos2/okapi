ALTER TABLE price_items
  ADD COLUMN IF NOT EXISTS woo_product_id int;

CREATE UNIQUE INDEX IF NOT EXISTS price_items_woo_product_id_business_id
  ON price_items (business_id, woo_product_id)
  WHERE woo_product_id IS NOT NULL;
