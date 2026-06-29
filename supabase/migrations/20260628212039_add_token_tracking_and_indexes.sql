
-- Token tracking on messages
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS input_tokens integer;
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS output_tokens integer;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation_id ON public.wa_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_sent_at ON public.wa_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_wa_messages_direction ON public.wa_messages(direction);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_client_status ON public.wa_conversations(client_id, status);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_updated_at ON public.wa_conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_search ON public.wa_conversations USING gin(
  to_tsvector('spanish', coalesce(customer_name,'') || ' ' || coalesce(customer_email,'') || ' ' || coalesce(customer_phone,'') || ' ' || coalesce(product_interest,''))
);
;
