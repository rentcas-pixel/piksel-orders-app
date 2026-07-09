-- Vartotojo el. pašto rašymo stilius (išmoktas iš Sent / Archive)

CREATE TABLE IF NOT EXISTS email_writing_style (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  style_guide TEXT NOT NULL DEFAULT '',
  emails_analyzed INTEGER NOT NULL DEFAULT 0,
  folders TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO email_writing_style (id, style_guide)
VALUES (1, '')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE email_writing_style ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'email_writing_style' AND policyname = 'Allow all on email_writing_style'
  ) THEN
    CREATE POLICY "Allow all on email_writing_style" ON email_writing_style FOR ALL USING (true);
  END IF;
END $$;
