-- Extended doctor profile fields
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS license_number   TEXT,
  ADD COLUMN IF NOT EXISTS experience_years SMALLINT,
  ADD COLUMN IF NOT EXISTS education        TEXT,
  ADD COLUMN IF NOT EXISTS languages        TEXT[],
  ADD COLUMN IF NOT EXISTS phone            TEXT,
  ADD COLUMN IF NOT EXISTS email            TEXT,
  ADD COLUMN IF NOT EXISTS certifications   TEXT,
  ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10,2);
