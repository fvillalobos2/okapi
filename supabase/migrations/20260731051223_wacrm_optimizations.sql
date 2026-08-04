-- wacrm optimizations: race-safe unique constraints, message status tracking

-- 1. Unique constraint on leads (prevents duplicate leads from concurrent webhooks)
CREATE UNIQUE INDEX IF NOT EXISTS leads_business_phone_unique
  ON leads (business_id, phone);

-- 2. Unique constraint on conversations (prevents duplicate conversations)
CREATE UNIQUE INDEX IF NOT EXISTS conversations_business_phone_unique
  ON conversations (business_id, phone);

-- 3. Message status tracking (wam_id → delivered/read status from Meta webhooks)
CREATE TABLE IF NOT EXISTS message_statuses (
  wam_id      text        PRIMARY KEY,
  business_id uuid        REFERENCES businesses(id) ON DELETE CASCADE,
  phone       text        NOT NULL,
  status      text        NOT NULL DEFAULT 'sent',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS message_statuses_business_phone
  ON message_statuses (business_id, phone);
