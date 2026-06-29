
ALTER TABLE public.wa_conversations ADD COLUMN IF NOT EXISTS sla_alerted_at timestamptz;
;
