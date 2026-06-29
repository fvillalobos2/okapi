
ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS follow_up_sent_at timestamptz;

ALTER TABLE public.wa_clients
  ADD COLUMN IF NOT EXISTS sales_whatsapp text;

UPDATE public.wa_clients
SET sales_whatsapp = 'whatsapp:+50685157780'
WHERE slug = 'innova';
;
