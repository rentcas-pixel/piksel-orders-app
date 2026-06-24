-- Sujungtų sąskaitų eilutės (keli užsakymai → viena sąskaita)

CREATE TABLE IF NOT EXISTS invoice_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  line_description TEXT NOT NULL,
  period_from DATE,
  period_to DATE,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_order_id ON invoice_lines (order_id);

ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'invoice_lines' AND policyname = 'Allow all on invoice_lines'
  ) THEN
    CREATE POLICY "Allow all on invoice_lines" ON invoice_lines FOR ALL USING (true);
  END IF;
END $$;
