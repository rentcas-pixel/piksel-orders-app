-- Open agentūros portalas: paleisk Supabase SQL Editor
-- 1) Šis blokas — įrašo Open agentūrą
-- 2) Authentication → Users → sukurk vartotoją (žr. žemiau)
-- 3) Antras blokas — susieja el. paštą su Open (pakeisk email)

INSERT INTO agencies (name, slug, pocketbase_values) VALUES
  ('Open', 'open', ARRAY['Open', 'open', 'Open Agency', 'open agency'])
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  pocketbase_values = EXCLUDED.pocketbase_values,
  updated_at = NOW();

-- Po to Supabase Dashboard:
-- Authentication → Users → Add user → Create new user
--   Email: open@piksel.lt   (arba kitas — tada pakeisk žemiau)
--   Password: (tavo pasirinktas)
--   ✅ Auto Confirm User
--
-- Tada paleisk šį bloką (PAKEISK email jei kitoks):

INSERT INTO agency_users (user_id, agency_id)
SELECT u.id, a.id
FROM auth.users u
CROSS JOIN agencies a
WHERE lower(u.email) = lower('open@piksel.lt')
  AND a.slug = 'open'
ON CONFLICT (user_id) DO UPDATE SET
  agency_id = EXCLUDED.agency_id;

-- Patikra:
SELECT u.email, ag.name AS agency, ag.slug
FROM agency_users au
JOIN auth.users u ON u.id = au.user_id
JOIN agencies ag ON ag.id = au.agency_id
WHERE ag.slug = 'open';
