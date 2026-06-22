-- Atskiri komentarai: internal (Piksel) vs agency (agentūros portalas)
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'internal'
  CHECK (visibility IN ('internal', 'agency'));

CREATE INDEX IF NOT EXISTS idx_comments_order_visibility
  ON comments (order_id, visibility);
