-- Add deleted_at to staff table for soft-delete
ALTER TABLE staff ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Add deleted_at to locations table for soft-delete
ALTER TABLE locations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Index for filtering out deleted records efficiently
CREATE INDEX IF NOT EXISTS staff_deleted_at_idx ON staff (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS locations_deleted_at_idx ON locations (deleted_at) WHERE deleted_at IS NULL;
