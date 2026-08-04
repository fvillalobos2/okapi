CREATE TABLE IF NOT EXISTS queued_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  to_number    text NOT NULL,
  payload      jsonb NOT NULL,
  send_at      timestamptz NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempt_count int NOT NULL DEFAULT 0,
  error_msg    text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS queued_messages_status_send_at
  ON queued_messages (status, send_at);
