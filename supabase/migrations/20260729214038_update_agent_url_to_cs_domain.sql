-- Rename cs-engine domain from innova.projectokapi.com to cs.projectokapi.com
UPDATE businesses
SET agent_url = 'https://cs.projectokapi.com'
WHERE agent_url = 'https://innova.projectokapi.com';
