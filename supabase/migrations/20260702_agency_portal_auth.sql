-- Agentūrų portalo autentifikacija: agentūros + vartotojų susiejimas

CREATE TABLE IF NOT EXISTS agencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  pocketbase_values TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agency_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_users_user ON agency_users (user_id);
CREATE INDEX IF NOT EXISTS idx_agency_users_agency ON agency_users (agency_id);

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agency_users' AND policyname = 'agency_users_select_own'
  ) THEN
    CREATE POLICY agency_users_select_own ON agency_users
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agencies' AND policyname = 'agencies_select_own'
  ) THEN
    CREATE POLICY agencies_select_own ON agencies
      FOR SELECT USING (
        id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Pradinės agentūros (pocketbase_values — visos PB reikšmės, kurias sutapatinti)
INSERT INTO agencies (name, slug, pocketbase_values) VALUES
  ('BPN', 'bpn', ARRAY['BPN', 'bpn']),
  ('OMG', 'omg', ARRAY['OMG', 'omg']),
  ('OMD', 'omd', ARRAY['OMD', 'omd']),
  ('MBD', 'mbd', ARRAY['MBD', 'mbd']),
  ('Dentsu', 'dentsu', ARRAY['Dentsu', 'dentsu']),
  ('Carat', 'carat', ARRAY['Carat', 'carat']),
  ('Mediacom', 'mediacom', ARRAY['Mediacom', 'mediacom']),
  ('Mindshare', 'mindshare', ARRAY['Mindshare', 'mindshare']),
  ('Media House', 'media-house', ARRAY['Media House', 'media house']),
  ('Arena Media', 'arena-media', ARRAY['Arena Media', 'arena media']),
  ('Havas Media', 'havas-media', ARRAY['Havas Media', 'Havas', 'havas media']),
  ('Publicis Groupe', 'publicis-groupe', ARRAY['Publicis Groupe', 'publicis groupe']),
  ('Open', 'open', ARRAY['Open', 'open', 'Open Agency', 'open agency'])
ON CONFLICT (slug) DO NOTHING;
