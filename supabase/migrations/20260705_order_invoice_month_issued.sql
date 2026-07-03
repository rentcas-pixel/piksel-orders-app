-- Rankinis „išrašyta“ žymėjimas kiekvienam mėnesiui (kelių mėnesių kampanijos)

ALTER TABLE order_invoice_month_flags
  ADD COLUMN IF NOT EXISTS invoice_issued BOOLEAN NOT NULL DEFAULT FALSE;
