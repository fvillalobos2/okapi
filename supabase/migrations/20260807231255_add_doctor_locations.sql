-- Doctor locations (consultorios)
-- A doctor can work at multiple physical locations.
-- Availability rows reference a location; appointments inherit it at booking time.

CREATE TABLE IF NOT EXISTS doctor_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,        -- "Consultorio Central", "Clínica del Norte"
  address     TEXT,
  maps_url    TEXT,                 -- Google Maps / Waze link
  phone       TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS doctor_locations_doctor_id_idx ON doctor_locations(doctor_id);

-- Link availability slots to a specific location
ALTER TABLE doctor_availability
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES doctor_locations(id) ON DELETE SET NULL;

-- Store the resolved location on confirmed appointments
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES doctor_locations(id) ON DELETE SET NULL;
