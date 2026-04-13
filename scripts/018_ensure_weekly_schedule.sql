-- Sicherstellen, dass die Spalte weekly_schedule vorhanden ist
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_schedule JSONB DEFAULT jsonb_build_object(
  'monday', 8,
  'tuesday', 8,
  'wednesday', 8,
  'thursday', 8,
  'friday', 8,
  'saturday', 0,
  'sunday', 0
);

UPDATE users
SET weekly_schedule = jsonb_build_object(
  'monday', weekly_hours / 5,
  'tuesday', weekly_hours / 5,
  'wednesday', weekly_hours / 5,
  'thursday', weekly_hours / 5,
  'friday', weekly_hours / 5,
  'saturday', 0,
  'sunday', 0
)
WHERE weekly_schedule IS NULL;

COMMENT ON COLUMN users.weekly_schedule IS 'Wöchentlicher Sollplan der Arbeitsstunden für jeden Wochentag';
