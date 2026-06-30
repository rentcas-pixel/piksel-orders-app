-- Gautų sąskaitų (išlaidų) lentelė

CREATE TABLE IF NOT EXISTS received_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT,
  seller_name TEXT NOT NULL,
  seller_company_code TEXT,
  seller_vat_code TEXT,
  seller_address TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  vat_amount NUMERIC(12, 2) NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  invoice_date DATE NOT NULL,
  due_date DATE,
  payment_date DATE,
  category TEXT,
  description TEXT,
  file_url TEXT,
  file_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_received_invoices_invoice_date ON received_invoices (invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_received_invoices_seller_name ON received_invoices (seller_name);
CREATE INDEX IF NOT EXISTS idx_received_invoices_payment_date ON received_invoices (payment_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_received_invoices_seller_invoice_unique
  ON received_invoices (seller_company_code, invoice_number)
  WHERE seller_company_code IS NOT NULL AND invoice_number IS NOT NULL;

ALTER TABLE received_invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'received_invoices' AND policyname = 'Allow all on received_invoices'
  ) THEN
    CREATE POLICY "Allow all on received_invoices" ON received_invoices FOR ALL USING (true);
  END IF;
END $$;
