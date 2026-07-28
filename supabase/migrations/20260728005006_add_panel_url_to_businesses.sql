-- add_panel_url_to_businesses
--
-- panel_url: the public URL where the admin panel for this business is hosted.
-- Pattern for Okapi-managed panels: https://{slug}.projectokapi.com
-- Pattern for client custom domains: https://admin.clientdomain.com
-- Used in the Settings page and for reference in onboarding checklists.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS panel_url text;

-- Seed known panels
UPDATE businesses SET panel_url = 'https://innova.projectokapi.com'
WHERE slug = 'innova' AND panel_url IS NULL;

UPDATE businesses SET panel_url = 'https://golfcartrentalscr.projectokapi.com'
WHERE slug = 'golfcartrentalscr' AND panel_url IS NULL;
