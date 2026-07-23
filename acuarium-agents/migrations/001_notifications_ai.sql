-- Run this in Supabase SQL Editor (project juknambxnuuovycjqlrf)

-- Add notification fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_pref text NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS product_interests text[];

-- Add AI toggle to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true;

-- Product AI context
ALTER TABLE price_items ADD COLUMN IF NOT EXISTS prompt_snippet text;
ALTER TABLE price_items ADD COLUMN IF NOT EXISTS product_keywords text[];

-- Product documents (PDF text content)
CREATE TABLE IF NOT EXISTS product_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  price_item_id uuid REFERENCES price_items(id) ON DELETE CASCADE,
  filename text NOT NULL,
  content_text text NOT NULL,
  file_url text,
  created_at timestamptz DEFAULT now()
);

-- Team product routing
ALTER TABLE teams ADD COLUMN IF NOT EXISTS product_interests text[];

-- Product team/user assignment and visual material (per-product legacy)
ALTER TABLE price_items ADD COLUMN IF NOT EXISTS assigned_team_id uuid REFERENCES teams(id);
ALTER TABLE price_items ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES users(id);
ALTER TABLE price_items ADD COLUMN IF NOT EXISTS image_url text;

-- Product categories (groups products, has AI agent + team + visual at category level)
CREATE TABLE IF NOT EXISTS product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  prompt_instructions text,
  product_keywords text[],
  assigned_team_id uuid REFERENCES teams(id),
  assigned_user_id uuid REFERENCES users(id),
  image_url text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Link price_items to categories
ALTER TABLE price_items ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES product_categories(id);

-- Allow category-level documents (price_item_id becomes optional)
ALTER TABLE product_documents ALTER COLUMN price_item_id DROP NOT NULL;
ALTER TABLE product_documents ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES product_categories(id) ON DELETE CASCADE;
