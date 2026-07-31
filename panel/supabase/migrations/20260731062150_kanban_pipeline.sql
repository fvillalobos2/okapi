ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pipeline_stage text;
CREATE INDEX IF NOT EXISTS idx_conversations_pipeline_stage ON conversations(pipeline_stage) WHERE pipeline_stage IS NOT NULL;
