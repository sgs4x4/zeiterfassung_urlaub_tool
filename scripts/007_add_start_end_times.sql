-- Füge start_time und end_time Felder zur time_entries Tabelle hinzu
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS end_time TIME;

-- Index für schnellere Überlappungsprüfung
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date_times 
ON time_entries(user_id, date, start_time, end_time);

-- Kommentar: Start/Endzeit sind optional - wenn gesetzt, werden Stunden automatisch berechnet
-- Bei Überlappung von Zeiträumen am selben Tag wird ein Fehler geworfen
