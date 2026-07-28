-- add_price_items_product_categories
--
-- Shared product catalog tables for multi-tenant panel.
-- Matches the schema expected by acuarium-agents /api/products and /api/categories routes.
-- Allows Innova and future clients to have their catalog in the central Supabase.

create table if not exists product_categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  sort_order  int  default 0,
  created_at  timestamptz default now()
);

create index if not exists idx_product_categories_business on product_categories(business_id, sort_order);

create table if not exists price_items (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  category_id  uuid references product_categories(id) on delete set null,
  name         text not null,
  description  text,
  price        numeric(12,2),
  unit         text,
  active       boolean default true,
  sort_order   int default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_price_items_business_active on price_items(business_id, active);

create table if not exists product_documents (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  price_item_id uuid references price_items(id) on delete cascade,
  filename     text not null,
  file_url     text not null,
  created_at   timestamptz default now()
);

create index if not exists idx_product_documents_business on product_documents(business_id);
create index if not exists idx_product_documents_item on product_documents(price_item_id);
