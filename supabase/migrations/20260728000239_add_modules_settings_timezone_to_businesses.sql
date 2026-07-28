-- ─────────────────────────────────────────────────────────────────────────────
-- add_modules_settings_timezone_to_businesses
--
-- Adds three columns to `businesses` that power the generic add-ons system:
--
--   modules  — JSONB feature flags per client. The CS Engine and admin panel
--              read this to activate/deactivate add-on flows at runtime.
--              Shape: { "product_catalog": {"enabled": true}, ... }
--
--   settings — JSONB configurable text + timing per client. Replaces hardcoded
--              strings in agent.py (reset messages, follow-up messages).
--              Shape: { "follow_up_hours": 24, "lost_after_hours": 48,
--                       "follow_up_message_es": "...", "reset_message_es": "..." }
--
--   timezone — IANA timezone string. Used by is_business_hours() in the CS
--              Engine so follow-up logic respects the client's local time,
--              not hardcoded Costa Rica UTC-6.
--
-- Idempotent — safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS modules  jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS timezone text  NOT NULL DEFAULT 'America/Costa_Rica';

-- Index for fast module lookups when the CS Engine checks if a module is enabled.
CREATE INDEX IF NOT EXISTS idx_businesses_modules ON businesses USING gin(modules);

-- Seed default modules for existing businesses so every row has an explicit
-- modules object matching what each client actually uses today.

-- GCR (Okapi internal) — provider flow + payments + ad referral
UPDATE businesses
SET modules = '{
  "provider_flow": {"enabled": true},
  "payments":      {"enabled": true, "provider": "tilopay"},
  "ad_referral":   {"enabled": true}
}'::jsonb
WHERE slug = 'golfcartrentalscr' AND modules = '{}'::jsonb;

-- Acuarium — product catalog, teams, shipping, ad referral
UPDATE businesses
SET modules = '{
  "product_catalog": {"enabled": true},
  "teams":           {"enabled": true},
  "shipping":        {"enabled": true},
  "ad_referral":     {"enabled": true}
}'::jsonb
WHERE slug = 'acuarium' AND modules = '{}'::jsonb;

-- Innova — discounts, crm, cost tracking
UPDATE businesses
SET modules = '{
  "discounts":     {"enabled": true},
  "crm":           {"enabled": true, "provider": "pipedrive"},
  "cost_tracking": {"enabled": true}
}'::jsonb
WHERE slug = 'innova' AND modules = '{}'::jsonb;
