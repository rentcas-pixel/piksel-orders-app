-- Nestandartinis sąskaitavimo grafikas (kampanijos su „tarpais“ tarp mėnesių)

CREATE TABLE IF NOT EXISTS order_billing_schedule (
  order_id TEXT NOT NULL,
  billing_year INTEGER NOT NULL,
  billing_month INTEGER NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_id, billing_year, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_order_billing_schedule_order
  ON order_billing_schedule (order_id);

ALTER TABLE order_billing_schedule ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_billing_schedule'
      AND policyname = 'Allow all on order_billing_schedule'
  ) THEN
    CREATE POLICY "Allow all on order_billing_schedule"
      ON order_billing_schedule FOR ALL USING (true);
  END IF;
END $$;
