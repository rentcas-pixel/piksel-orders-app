-- Partnerių plano / klipų siuntimo būsenos + confirm tokenai
CREATE TABLE IF NOT EXISTS partner_deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  partner_name TEXT NOT NULL,
  campaign_label TEXT,
  stage TEXT NOT NULL CHECK (stage IN ('plan', 'clips')),
  token TEXT NOT NULL UNIQUE,
  to_email TEXT NOT NULL,
  resend_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_deliveries_order_id ON partner_deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_partner_deliveries_token ON partner_deliveries(token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_deliveries_order_partner_stage
  ON partner_deliveries(order_id, partner_id, stage);

ALTER TABLE partner_deliveries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'partner_deliveries' AND policyname = 'Allow all operations on partner_deliveries'
  ) THEN
    CREATE POLICY "Allow all operations on partner_deliveries" ON partner_deliveries FOR ALL USING (true);
  END IF;
END $$;
