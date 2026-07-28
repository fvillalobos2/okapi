-- Backfill ear_tag from display_id for all animals that have no ear tag set.
-- display_id is the arete (ear tag) number in this system.
UPDATE public.animals
SET ear_tag = display_id
WHERE ear_tag IS NULL OR ear_tag = '';
