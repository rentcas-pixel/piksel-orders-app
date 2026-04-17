-- Supabase lentelių sukūrimas Piksel Orders sistemai

-- 1. Komentarai
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Priminimai
CREATE TABLE IF NOT EXISTS reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Failų priedai
CREATE TABLE IF NOT EXISTS file_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Patvirtinimo įvykiai (audit trail)
CREATE TABLE IF NOT EXISTS order_approval_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  approved_by TEXT,
  snapshot_client TEXT,
  snapshot_amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_approval_events_order_id ON order_approval_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_approval_events_approved_at ON order_approval_events(approved_at DESC);

-- 5. Sąskaitų būsenos pagal užsakymą
CREATE TABLE IF NOT EXISTS order_invoice_status (
  order_id TEXT PRIMARY KEY,
  invoice_issued BOOLEAN NOT NULL DEFAULT FALSE,
  invoice_sent BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_invoice_status_updated_at ON order_invoice_status(updated_at DESC);

-- 6. RLS (Row Level Security) įjungimas
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_approval_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_invoice_status ENABLE ROW LEVEL SECURITY;

-- 7. RLS politikos (visi gali skaityti ir rašyti)
CREATE POLICY "Allow all operations on comments" ON comments FOR ALL USING (true);
CREATE POLICY "Allow all operations on reminders" ON reminders FOR ALL USING (true);
CREATE POLICY "Allow all operations on file_attachments" ON file_attachments FOR ALL USING (true);
CREATE POLICY "Allow all operations on order_approval_events" ON order_approval_events FOR ALL USING (true);
CREATE POLICY "Allow all operations on order_invoice_status" ON order_invoice_status FOR ALL USING (true);

-- 8. Storage bucket sukūrimas (reikia atlikti per Supabase dashboard)
-- Eikite į Storage -> New Bucket -> pavadinimas: "files" -> public
