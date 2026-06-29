
-- ─── BUSINESSES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  whatsapp_number text NOT NULL,
  twilio_sender text NOT NULL,
  base_prompt text,
  tone_rules text,
  active boolean DEFAULT true,
  default_commission_pct numeric(5,2) DEFAULT 10.0,
  min_commission_pct numeric(5,2) DEFAULT 5.0,
  auto_accept_counter_within_pct numeric(5,2) DEFAULT 2.0,
  admin_whatsapp text,
  follow_up_hours int DEFAULT 24,
  provider_timeout_hours int DEFAULT 4,
  created_at timestamptz DEFAULT now()
);

-- ─── SERVICES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_range text,
  booking_flow_steps jsonb DEFAULT '[]',
  active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ─── LOCATIONS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean DEFAULT true
);

-- ─── LEADS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  phone text NOT NULL,
  name text,
  email text,
  source_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  status text DEFAULT 'new' CHECK (status IN ('new','active','booked','lost')),
  follow_up_sent_at timestamptz,
  follow_up_responded boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now(),
  UNIQUE(business_id, phone)
);

-- ─── CONVERSATIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id),
  business_id uuid REFERENCES businesses(id),
  phone text NOT NULL,
  messages jsonb DEFAULT '[]',
  status text DEFAULT 'active' CHECK (status IN ('active','booked','cancelled')),
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- ─── PROVIDERS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  location_name text NOT NULL,
  whatsapp_number text NOT NULL,
  default_commission_pct numeric(5,2) DEFAULT 10.0,
  active boolean DEFAULT true,
  avg_response_time_minutes numeric(8,2),
  acceptance_rate numeric(5,2) DEFAULT 100.0,
  total_bookings int DEFAULT 0,
  total_rejected int DEFAULT 0,
  whatsapp_verified boolean DEFAULT false
);

-- ─── BOOKINGS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id),
  business_id uuid REFERENCES businesses(id),
  lead_id uuid REFERENCES leads(id),
  client_phone text,
  booking_details jsonb DEFAULT '{}',
  booking_text text,
  order_number text UNIQUE,
  provider_number text,
  provider_id uuid REFERENCES providers(id),
  rental_amount numeric(10,2),
  fee_amount numeric(10,2),
  currency text DEFAULT 'USD',
  commission_pct_offered numeric(5,2),
  commission_pct_final numeric(5,2),
  commission_negotiation_status text DEFAULT 'pending'
    CHECK (commission_negotiation_status IN ('pending','accepted','rejected','countered')),
  commission_counter_offer numeric(5,2),
  payment_status text DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','cancelled')),
  modification_requests jsonb DEFAULT '[]',
  provider_contacted_at timestamptz,
  provider_responded_at timestamptz,
  paid_at timestamptz,
  link_sent boolean DEFAULT false,
  follow_up_sent boolean DEFAULT false,
  payment_processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  provider_messages jsonb DEFAULT '[]'
);

-- ─── PENDING CANCELLATIONS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_phone text NOT NULL UNIQUE,
  business_id uuid REFERENCES businesses(id),
  type text NOT NULL,
  order_number text,
  provider_number text,
  booking_text text,
  created_at timestamptz DEFAULT now()
);

-- ─── PROMPT VERSIONS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  prompt_snapshot text NOT NULL,
  created_by text DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT false
);

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  booking_id uuid REFERENCES bookings(id),
  lead_phone text,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
CREATE INDEX IF NOT EXISTS idx_conversations_business ON conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_business_status ON leads(business_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_number);
CREATE INDEX IF NOT EXISTS idx_bookings_order ON bookings(order_number);
CREATE INDEX IF NOT EXISTS idx_bookings_business ON bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(business_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_providers_number ON providers(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_providers_location ON providers(business_id, location_name);
CREATE INDEX IF NOT EXISTS idx_notifications_business_created ON notifications(business_id, created_at DESC);

-- ─── DISABLE RLS (backend-only app) ──────────────────────────────────────────
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE providers DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE pending_cancellations DISABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
;
