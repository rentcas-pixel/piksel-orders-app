-- Atnaujina esamą invoices lentelę (jei sukurta seniau be buyer_* stulpelių)
-- Paleisk Supabase SQL Editor, jei INSERT meta klaidą „column buyer_name does not exist“

-- billing_companies (nauja lentelė)
CREATE TABLE IF NOT EXISTS billing_companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  company_code TEXT,
  vat_code TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_companies_name ON billing_companies (name);
CREATE INDEX IF NOT EXISTS idx_billing_companies_full_name ON billing_companies (full_name);

ALTER TABLE billing_companies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'billing_companies' AND policyname = 'Allow all on billing_companies'
  ) THEN
    CREATE POLICY "Allow all on billing_companies" ON billing_companies FOR ALL USING (true);
  END IF;
END $$;

-- invoices: pridėti trūkstamus stulpelius (senoji schema)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buyer_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buyer_company_code TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buyer_vat_code TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buyer_address TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS line_description TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS period_from DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS period_to DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices (order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices (invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices (created_at DESC);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'invoices' AND policyname = 'Allow all on invoices'
  ) THEN
    CREATE POLICY "Allow all on invoices" ON invoices FOR ALL USING (true);
  END IF;
END $$;
