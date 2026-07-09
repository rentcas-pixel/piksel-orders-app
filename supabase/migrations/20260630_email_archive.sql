-- Archyvavimo laukas apdorotiems laiškams

ALTER TABLE processed_emails
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_processed_emails_archived_at ON processed_emails(archived_at);
