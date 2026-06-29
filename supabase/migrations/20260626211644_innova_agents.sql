-- Clients (Innova, future clients)
create table if not exists wa_clients (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  twilio_number text not null,
  system_prompt text,
  created_at timestamptz default now()
);

-- One conversation per phone number per client
create table if not exists wa_conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references wa_clients(id) on delete cascade,
  customer_phone text not null,
  customer_name text,
  status text default 'active' check (status in ('active', 'pending_human', 'closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(client_id, customer_phone)
);

-- All messages in/out
create table if not exists wa_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references wa_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  approved_by text,
  sent_at timestamptz default now(),
  needs_approval boolean default false,
  approved boolean default false
);

-- Indexes
create index if not exists idx_wa_conversations_client_status_initial on wa_conversations(client_id, status);
create index if not exists idx_wa_messages_conversation_sent_at_initial on wa_messages(conversation_id, sent_at);

-- Enable realtime
do $$
begin
  begin
    alter publication supabase_realtime add table wa_conversations;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table wa_messages;
  exception when duplicate_object then null;
  end;
end $$;
