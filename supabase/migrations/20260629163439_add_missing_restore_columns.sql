alter table public.providers
  add column if not exists whatsapp_verified boolean default false;

alter table public.bookings
  add column if not exists provider_messages jsonb default '[]'::jsonb;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id),
  type text not null,
  title text not null,
  body text,
  booking_id uuid references public.bookings(id),
  lead_phone text,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_business_created
  on public.notifications(business_id, created_at desc);

alter table public.notifications disable row level security;
