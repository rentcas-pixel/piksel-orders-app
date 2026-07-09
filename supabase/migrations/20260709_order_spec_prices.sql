-- Spec. užsakymai: rankinė kaina (hub metadata, ne PocketBase schema)

CREATE TABLE IF NOT EXISTS order_spec_prices (
  order_id TEXT PRIMARY KEY,
  manual_price NUMERIC NOT NULL CHECK (manual_price > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_spec_prices_updated
  ON order_spec_prices (updated_at DESC);

ALTER TABLE order_spec_prices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_spec_prices'
      AND policyname = 'Allow all on order_spec_prices'
  ) THEN
    CREATE POLICY "Allow all on order_spec_prices"
      ON order_spec_prices FOR ALL USING (true);
  END IF;
END $$;
