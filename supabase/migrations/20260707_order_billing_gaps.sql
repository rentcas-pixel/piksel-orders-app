-- Sąskaitavimo tarpai: datos, kai kampanijos metu nėra sąskaituojama

DROP TABLE IF EXISTS order_billing_schedule;

CREATE TABLE IF NOT EXISTS order_billing_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  gap_from DATE NOT NULL,
  gap_to DATE NOT NULL CHECK (gap_from <= gap_to),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_billing_gaps_order
  ON order_billing_gaps (order_id);

ALTER TABLE order_billing_gaps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_billing_gaps'
      AND policyname = 'Allow all on order_billing_gaps'
  ) THEN
    CREATE POLICY "Allow all on order_billing_gaps"
      ON order_billing_gaps FOR ALL USING (true);
  END IF;
END $$;
