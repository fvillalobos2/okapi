-- acuarium_compat_columns
--
-- Extends conversations and leads with columns used by the CS agent (cs-engine-legacy)
-- and the admin panel, enabling Acuarium to share the central Supabase.
--
-- conversations.messages is the canonical message history column (already exists for GCR).
-- The panel and cs-engine-legacy both read/write this field.
-- The remaining columns enable per-conversation AI toggling, soft-delete via archived,
-- team/agent routing, and language detection.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS archived     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_enabled   boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz          DEFAULT now(),
  ADD COLUMN IF NOT EXISTS team_id      uuid        REFERENCES teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to  uuid        REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS language     text                 DEFAULT 'es';

-- Back-fill updated_at from last_message_at for existing rows.
UPDATE conversations SET updated_at = last_message_at WHERE updated_at IS NULL AND last_message_at IS NOT NULL;

-- leads: add routing and qualification columns used by Acuarium cs-engine-legacy.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS zone             text,
  ADD COLUMN IF NOT EXISTS team_id         uuid REFERENCES teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to     uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_interest text,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS source          text DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS notification_pref text;

-- users: add columns used by Acuarium panel.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone             text,
  ADD COLUMN IF NOT EXISTS notification_pref text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS product_interests jsonb;

-- teams: add zone and contact columns from Acuarium schema.
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS zone              text,
  ADD COLUMN IF NOT EXISTS whatsapp          text,
  ADD COLUMN IF NOT EXISTS email             text,
  ADD COLUMN IF NOT EXISTS product_interests jsonb;
