-- Fine-granular vacation email preferences per status.
-- Used for both employees and admins.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_vacation_pending BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_vacation_approved BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_vacation_rejected BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_vacation_withdrawn BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE users
SET
  notify_vacation_pending = COALESCE(notify_vacation_pending, TRUE),
  notify_vacation_approved = COALESCE(notify_vacation_approved, TRUE),
  notify_vacation_rejected = COALESCE(notify_vacation_rejected, TRUE),
  notify_vacation_withdrawn = COALESCE(notify_vacation_withdrawn, TRUE),
  notify_vacation_status = COALESCE(notify_vacation_status, TRUE);

COMMIT;
