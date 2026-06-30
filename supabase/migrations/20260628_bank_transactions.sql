-- Banko pavedimai ir dalinis sąskaitų apmokėjimas (FIFO sudengimas)

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE received_invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

UPDATE invoices
SET paid_amount = total_amount
WHERE payment_date IS NOT NULL AND COALESCE(paid_amount, 0) = 0;

UPDATE received_invoices
SET paid_amount = total_amount
WHERE payment_date IS NOT NULL AND COALESCE(paid_amount, 0) = 0;

CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
  counterparty TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions (transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_direction ON bank_transactions (direction);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_counterparty ON bank_transactions (counterparty);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_transaction_id UUID NOT NULL REFERENCES bank_transactions (id) ON DELETE CASCADE,
  issued_invoice_id UUID REFERENCES invoices (id) ON DELETE CASCADE,
  received_invoice_id UUID REFERENCES received_invoices (id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_allocations_invoice_xor CHECK (
    (issued_invoice_id IS NOT NULL AND received_invoice_id IS NULL)
    OR (issued_invoice_id IS NULL AND received_invoice_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_bank_tx
  ON payment_allocations (bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_issued
  ON payment_allocations (issued_invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_received
  ON payment_allocations (received_invoice_id);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_transactions' AND policyname = 'Allow all on bank_transactions'
  ) THEN
    CREATE POLICY "Allow all on bank_transactions" ON bank_transactions FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_allocations' AND policyname = 'Allow all on payment_allocations'
  ) THEN
    CREATE POLICY "Allow all on payment_allocations" ON payment_allocations FOR ALL USING (true);
  END IF;
END $$;
