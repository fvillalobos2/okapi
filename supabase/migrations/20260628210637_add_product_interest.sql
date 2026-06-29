
ALTER TABLE public.wa_conversations ADD COLUMN IF NOT EXISTS product_interest text;
ALTER TABLE public.wa_clients ADD COLUMN IF NOT EXISTS pipedrive_product_field_key text;
UPDATE public.wa_clients SET pipedrive_product_field_key = '0dcb942ac18094c49bfa2260ca05cf2f5d7e5682' WHERE slug = 'innova';
;
