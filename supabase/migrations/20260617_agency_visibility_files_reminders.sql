-- Atskiri agentūrų ir vidaus printscreen / priminimai (kaip komentarams)

ALTER TABLE file_attachments
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'internal'
  CHECK (visibility IN ('internal', 'agency'));

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'internal'
  CHECK (visibility IN ('internal', 'agency'));

CREATE INDEX IF NOT EXISTS idx_file_attachments_order_visibility
  ON file_attachments (order_id, visibility);

CREATE INDEX IF NOT EXISTS idx_reminders_order_visibility
  ON reminders (order_id, visibility);
