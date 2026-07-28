-- discounts: configurable discount rules per business.
-- Used by the AI agent to offer discounts and by the admin panel to manage them.

create table if not exists discounts (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('percentage', 'fixed')),
  value       numeric(10,2) not null,
  condition   text,
  active      boolean default true,
  sort_order  int default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists idx_discounts_business_active on discounts(business_id, active);
