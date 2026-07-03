-- Aktyvūs kampanijos periodai (sąskaituojamos dienos)

DROP TABLE IF EXISTS order_billing_gaps;

CREATE TABLE IF NOT EXISTS order_billing_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  active_from DATE NOT NULL,
  active_to DATE NOT NULL CHECK (active_from <= active_to),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_billing_periods_order
  ON order_billing_periods (order_id);

ALTER TABLE order_billing_periods ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_billing_periods'
      AND policyname = 'Allow all on order_billing_periods'
  ) THEN
    CREATE POLICY "Allow all on order_billing_periods"
      ON order_billing_periods FOR ALL USING (true);
  END IF;
END $$;
