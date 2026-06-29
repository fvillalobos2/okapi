create table if not exists wa_discounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references wa_clients(id) on delete cascade,
  name text not null,
  type text not null check (type in ('percentage', 'fixed')),
  value numeric(10,2) not null,
  condition text,
  active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_wa_discounts_client_active on wa_discounts(client_id, active);
;
