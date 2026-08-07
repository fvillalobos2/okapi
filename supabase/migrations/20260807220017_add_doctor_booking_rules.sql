-- Booking rules per doctor (enforced by the public slots API)
-- min_advance_hours : minimum hours in advance a patient can book (default 0)
-- max_advance_days  : how many days ahead patients can see availability (default 60)
-- buffer_minutes    : gap added after each appointment before next slot is offered (default 0)
-- max_per_day       : maximum appointments the doctor accepts per day (default null = unlimited)
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS booking_rules JSONB NOT NULL DEFAULT '{}';
