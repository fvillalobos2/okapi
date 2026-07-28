ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS default_gdp_kg_day   numeric(5,3) DEFAULT 0.500,
  ADD COLUMN IF NOT EXISTS use_default_gdp       boolean      DEFAULT true;
