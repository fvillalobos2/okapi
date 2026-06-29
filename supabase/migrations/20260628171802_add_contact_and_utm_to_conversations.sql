
ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS customer_email     text,
  ADD COLUMN IF NOT EXISTS pipedrive_person_id integer,
  ADD COLUMN IF NOT EXISTS utm_source         text,
  ADD COLUMN IF NOT EXISTS utm_medium         text,
  ADD COLUMN IF NOT EXISTS utm_campaign       text,
  ADD COLUMN IF NOT EXISTS utm_content        text,
  ADD COLUMN IF NOT EXISTS utm_term           text,
  ADD COLUMN IF NOT EXISTS gclid              text;
;
