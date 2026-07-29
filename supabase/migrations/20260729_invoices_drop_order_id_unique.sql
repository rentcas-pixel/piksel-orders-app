-- Metinėms / kelių mėnesių kampanijoms reikia kelių sąskaitų tam pačiam order_id.
-- Senas unique invoices_order_id_key blokavo antrą mėnesį (409 / 23505).

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_order_id_key;

-- Non-unique index jau yra (idx_invoices_order_id); jei trūktų — sukuriame.
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices (order_id);
