
ALTER TABLE public.wa_clients
  ADD COLUMN IF NOT EXISTS pipedrive_pipeline_id integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS pipedrive_stage_id    integer DEFAULT 19;

UPDATE public.wa_clients
SET pipedrive_pipeline_id = 3, pipedrive_stage_id = 19
WHERE slug = 'innova';
;
