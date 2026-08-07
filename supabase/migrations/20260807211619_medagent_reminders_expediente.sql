-- MedAgent: recordatorios + expediente clínico expandido

-- ── patients: campos clínicos ─────────────────────────────────────────────────
ALTER TABLE patients ADD COLUMN IF NOT EXISTS blood_type                text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergies                 text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS current_medications       text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS pathological_history      text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS non_pathological_history  text;

-- ── appointments: diagnóstico + tracking de recordatorios ────────────────────
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS diagnosis_code        text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS diagnosis_notes       text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_24h_sent_at  timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_2h_sent_at   timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_confirmed_at  timestamptz;

-- ── patient_files: adjuntos del expediente ───────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  patient_id     uuid NOT NULL REFERENCES patients(id)  ON DELETE CASCADE,
  appointment_id uuid          REFERENCES appointments(id) ON DELETE SET NULL,
  filename       text NOT NULL,
  file_url       text NOT NULL,
  file_type      text DEFAULT 'other',
  notes          text,
  uploaded_at    timestamptz DEFAULT now()
);

ALTER TABLE patient_files ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "business_isolation" ON patient_files
    USING (business_id = current_setting('app.business_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS patient_files_patient_idx ON patient_files(patient_id);
CREATE INDEX IF NOT EXISTS appt_reminder_idx ON appointments(business_id, date, status)
  WHERE reminder_24h_sent_at IS NULL OR reminder_2h_sent_at IS NULL;
