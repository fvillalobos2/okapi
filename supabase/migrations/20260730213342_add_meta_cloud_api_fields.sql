-- Meta Cloud API fields for WhatsApp direct integration (alternative to Twilio)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_access_token    TEXT,
  ADD COLUMN IF NOT EXISTS meta_app_secret      TEXT,
  ADD COLUMN IF NOT EXISTS meta_verify_token    TEXT;
