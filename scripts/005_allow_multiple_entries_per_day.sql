-- Entferne die unique constraint für user_id+date
-- So können mehrere Einträge pro Tag erstellt werden
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_user_id_date_key;

-- Füge einen Index hinzu für Performance
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(user_id, date);
