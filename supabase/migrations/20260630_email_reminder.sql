-- El. pašto priminimai (snooze)

ALTER TABLE processed_emails
  ADD COLUMN IF NOT EXISTS remind_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS remind_note TEXT;

CREATE INDEX IF NOT EXISTS idx_processed_emails_remind_at ON processed_emails(remind_at);
