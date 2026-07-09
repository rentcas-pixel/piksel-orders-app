-- Laiško gavėjų laukai (atsakymams / reply-all)

ALTER TABLE processed_emails
  ADD COLUMN IF NOT EXISTS to_addresses TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cc_addresses TEXT[] NOT NULL DEFAULT '{}';
