ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS pipeline_stage text;
