-- Vienas įrašas: tikras sąskaitos likutis (ne tik importuotų pavedimų suma)

CREATE TABLE IF NOT EXISTS bank_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  account_balance NUMERIC(12, 2),
  balance_as_of DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO bank_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE bank_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_settings' AND policyname = 'Allow all on bank_settings'
  ) THEN
    CREATE POLICY "Allow all on bank_settings" ON bank_settings FOR ALL USING (true);
  END IF;
END $$;
