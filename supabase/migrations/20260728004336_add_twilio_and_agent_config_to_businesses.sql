-- add_twilio_and_agent_config_to_businesses
--
-- Each business can have its own Twilio account (SID + auth token) and its own
-- WhatsApp sender number. This lets the CS Engine serve multiple clients without
-- sharing a single Twilio account.
--
-- agent_url: the CS Engine base URL for this business — used to construct the
-- Twilio webhook URL shown in the admin panel's Settings page.
--
-- Falls back to env-var values (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
-- TWILIO_WA_NUMBER) when these columns are NULL so existing deployments keep
-- working with no changes.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS twilio_account_sid text,
  ADD COLUMN IF NOT EXISTS twilio_auth_token  text,
  ADD COLUMN IF NOT EXISTS agent_url          text;

-- Seed GCR agent_url (twilio_account_sid set manually via Settings panel — not stored in repo).
UPDATE businesses
SET agent_url = 'https://agent.projectokapi.com'
WHERE slug = 'golfcartrentalscr'
  AND agent_url IS NULL;
