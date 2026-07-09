-- El. pašto AI agentas: apdoroti laiškai ir sync būsena

CREATE TABLE IF NOT EXISTS email_sync_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_synced_at TIMESTAMPTZ,
  last_sync_count INTEGER DEFAULT 0,
  last_sync_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO email_sync_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS processed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imap_uid BIGINT NOT NULL,
  message_id TEXT,
  folder TEXT NOT NULL DEFAULT 'INBOX',
  subject TEXT,
  from_address TEXT,
  from_name TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  body_text TEXT,
  body_html TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  category TEXT NOT NULL CHECK (category IN (
    'urgent', 'needs_reply', 'invoice_payment', 'informational', 'ignore'
  )),
  summary TEXT,
  importance_reason TEXT,
  recommended_action TEXT,
  draft_reply TEXT,
  draft_status TEXT NOT NULL DEFAULT 'none' CHECK (draft_status IN ('none', 'draft', 'sent')),
  sent_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (folder, imap_uid)
);

CREATE INDEX IF NOT EXISTS idx_processed_emails_received_at ON processed_emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_processed_emails_category ON processed_emails(category);
CREATE INDEX IF NOT EXISTS idx_processed_emails_draft_status ON processed_emails(draft_status);

ALTER TABLE email_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_emails ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'email_sync_state' AND policyname = 'Allow all on email_sync_state'
  ) THEN
    CREATE POLICY "Allow all on email_sync_state" ON email_sync_state FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'processed_emails' AND policyname = 'Allow all on processed_emails'
  ) THEN
    CREATE POLICY "Allow all on processed_emails" ON processed_emails FOR ALL USING (true);
  END IF;
END $$;
