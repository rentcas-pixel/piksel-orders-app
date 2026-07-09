-- Perskaitymo būsena (nauji vs skaityti laiškai)

ALTER TABLE processed_emails
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_processed_emails_read_at ON processed_emails(read_at);
