-- User notification preferences
-- Stores whether a user wants vacation status emails.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_vacation_status BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE users
SET notify_vacation_status = TRUE
WHERE notify_vacation_status IS NULL;

COMMIT;
