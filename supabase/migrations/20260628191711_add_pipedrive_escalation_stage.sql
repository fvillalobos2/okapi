
ALTER TABLE public.wa_clients ADD COLUMN IF NOT EXISTS pipedrive_escalation_stage_id integer DEFAULT 23;
UPDATE public.wa_clients SET pipedrive_escalation_stage_id = 23 WHERE slug = 'innova';
;
