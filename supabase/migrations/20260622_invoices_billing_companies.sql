-- Sąskaitų ir pirkėjų įmonių lentelės

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

CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  vat_amount NUMERIC(12, 2) NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  buyer_name TEXT NOT NULL,
  buyer_company_code TEXT,
  buyer_vat_code TEXT,
  buyer_address TEXT,
  line_description TEXT,
  period_from DATE,
  period_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices (order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices (invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices (created_at DESC);

ALTER TABLE billing_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on billing_companies" ON billing_companies FOR ALL USING (true);
CREATE POLICY "Allow all on invoices" ON invoices FOR ALL USING (true);
