-- add_teams_users
--
-- Teams (branches/locations) and panel users per business.
-- These tables are already in the Acuarium Supabase; creating here for the
-- central CS Engine Supabase so Innova and future clients can use them.

create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  address     text,
  phone       text,
  active      boolean default true,
  created_at  timestamptz default now()
);

create index if not exists idx_teams_business on teams(business_id, active);

create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  team_id     uuid references teams(id) on delete set null,
  name        text not null,
  email       text,
  role        text default 'agent',
  active      boolean default true,
  created_at  timestamptz default now()
);

create index if not exists idx_users_business on users(business_id, active);
