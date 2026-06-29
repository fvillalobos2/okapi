create table if not exists wa_price_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references wa_clients(id) on delete cascade,
  category text not null,
  name text not null,
  unit text not null default 'm²',
  price_min numeric(10,2),
  price_max numeric(10,2),
  currency text not null default 'USD',
  notes text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_wa_price_items_client_category on wa_price_items(client_id, category);
;
