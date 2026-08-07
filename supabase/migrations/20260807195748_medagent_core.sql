-- MedAgent core tables
-- Completely isolated from existing platform tables.
-- Only used when business has modules->>'medical' = 'true'.
-- All tables scoped by business_id for multi-tenancy.

-- Doctors
CREATE TABLE IF NOT EXISTS doctors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  specialty     TEXT,
  bio           TEXT,
  photo_url     TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS doctors_business_id_idx ON doctors(business_id);

-- Services (consultation types) — optionally linked to a specific doctor
CREATE TABLE IF NOT EXISTS med_services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  doctor_id        UUID REFERENCES doctors(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  duration_minutes INT NOT NULL DEFAULT 30,
  price            NUMERIC(10,2),
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS med_services_business_id_idx ON med_services(business_id);
CREATE INDEX IF NOT EXISTS med_services_doctor_id_idx ON med_services(doctor_id);

-- Weekly availability per doctor (recurring schedule)
CREATE TABLE IF NOT EXISTS doctor_availability (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id    UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS doctor_availability_doctor_id_idx ON doctor_availability(doctor_id);

-- Availability overrides — vacations, holidays, extra hours on specific dates
CREATE TABLE IF NOT EXISTS doctor_availability_overrides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id    UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  is_blocked   BOOLEAN NOT NULL DEFAULT true, -- true = day off / blocked
  start_time   TIME,                          -- null when fully blocked
  end_time     TIME,
  note         TEXT
);
CREATE INDEX IF NOT EXISTS doc_avail_overrides_doctor_date_idx ON doctor_availability_overrides(doctor_id, date);

-- Patient profiles — keyed by phone number per business
CREATE TABLE IF NOT EXISTS patients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone         TEXT NOT NULL,
  name          TEXT,
  email         TEXT,
  date_of_birth DATE,
  notes         TEXT, -- clinic-facing notes only, not medical history
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, phone)
);
CREATE INDEX IF NOT EXISTS patients_business_phone_idx ON patients(business_id, phone);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id     UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  service_id    UUID REFERENCES med_services(id) ON DELETE SET NULL,
  date          DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  status        TEXT NOT NULL DEFAULT 'requested'
                  CHECK (status IN ('requested','confirmed','completed','cancelled','no_show')),
  patient_note  TEXT, -- reason / concern as stated by the patient
  confirmed_at  TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appointments_business_id_idx ON appointments(business_id);
CREATE INDEX IF NOT EXISTS appointments_doctor_date_idx ON appointments(doctor_id, date);
CREATE INDEX IF NOT EXISTS appointments_patient_id_idx ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS appointments_status_idx ON appointments(status);
