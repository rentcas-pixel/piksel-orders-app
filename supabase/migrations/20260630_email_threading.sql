-- Laiškų gijos: In-Reply-To ir References antraštės

ALTER TABLE processed_emails
  ADD COLUMN IF NOT EXISTS in_reply_to TEXT;

ALTER TABLE processed_emails
  ADD COLUMN IF NOT EXISTS reference_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_processed_emails_in_reply_to ON processed_emails(in_reply_to);
CREATE INDEX IF NOT EXISTS idx_processed_emails_message_id ON processed_emails(message_id);
