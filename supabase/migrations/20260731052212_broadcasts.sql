-- Broadcast / bulk messaging

CREATE TABLE IF NOT EXISTS broadcasts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  message      text        NOT NULL,
  status       text        NOT NULL DEFAULT 'draft',  -- draft | sending | completed | failed
  total_count  int         NOT NULL DEFAULT 0,
  sent_count   int         NOT NULL DEFAULT 0,
  error_count  int         NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz
);
CREATE INDEX IF NOT EXISTS broadcasts_business_id ON broadcasts (business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid        NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  phone        text        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending',  -- pending | sent | failed | skipped
  wam_id       text,
  error_msg    text,
  sent_at      timestamptz
);
CREATE INDEX IF NOT EXISTS broadcast_recipients_broadcast ON broadcast_recipients (broadcast_id, status);
