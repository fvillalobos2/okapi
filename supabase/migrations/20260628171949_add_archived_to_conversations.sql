
ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
;
