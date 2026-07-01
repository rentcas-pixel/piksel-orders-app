-- Mėnesio „išsiųsta“ žymėjimas daugiamėnėms kampanijoms (sąskaita išrašyta skaičiuojama iš invoices / invoice_lines)

CREATE TABLE IF NOT EXISTS order_invoice_month_flags (
  order_id TEXT NOT NULL,
  billing_year INTEGER NOT NULL,
  billing_month INTEGER NOT NULL,
  invoice_sent BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_id, billing_year, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_order_invoice_month_flags_order
  ON order_invoice_month_flags (order_id);

ALTER TABLE order_invoice_month_flags ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_invoice_month_flags'
      AND policyname = 'Allow all on order_invoice_month_flags'
  ) THEN
    CREATE POLICY "Allow all on order_invoice_month_flags"
      ON order_invoice_month_flags FOR ALL USING (true);
  END IF;
END $$;
