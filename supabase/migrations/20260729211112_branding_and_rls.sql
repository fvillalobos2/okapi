-- Task 2: Branding columns
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS accent_color text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS logo_url      text;

-- Task 1: Migrate Acuarium from cs-engine-legacy to central cs-engine
-- Credentials applied directly to DB; not stored in version control.
UPDATE businesses
SET agent_url = 'https://innova.projectokapi.com'
WHERE slug = 'acuarium';

-- Task 4: RLS — service_role bypasses automatically; anon gets no access by default
ALTER TABLE businesses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts          ENABLE ROW LEVEL SECURITY;
