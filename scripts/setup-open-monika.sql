-- Open portalas: monika.z@openagency.lt
-- Paleisk visą bloką Supabase SQL Editor

-- 1) Open agentūra (jei dar nėra)
INSERT INTO agencies (name, slug, pocketbase_values) VALUES
  ('Open', 'open', ARRAY['Open', 'open', 'Open Agency', 'open agency'])
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  pocketbase_values = EXCLUDED.pocketbase_values,
  updated_at = NOW();

-- 2) Susieti vartotoją su Open
INSERT INTO agency_users (user_id, agency_id)
SELECT u.id, a.id
FROM auth.users u
CROSS JOIN agencies a
WHERE u.id = '3f82274c-31db-4c51-8e5d-dc957e295d8b'
  AND a.slug = 'open'
ON CONFLICT (user_id) DO UPDATE SET
  agency_id = EXCLUDED.agency_id;

-- 3) Patikra
SELECT u.email, ag.name AS agency, ag.slug
FROM agency_users au
JOIN auth.users u ON u.id = au.user_id
JOIN agencies ag ON ag.id = au.agency_id
WHERE u.email = 'monika.z@openagency.lt';
