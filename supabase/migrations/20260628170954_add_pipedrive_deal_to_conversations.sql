
ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS pipedrive_deal_id integer,
  ADD COLUMN IF NOT EXISTS pipedrive_sent_at  timestamptz;
;
