-- Füge Bundesland-Feld zu users-Tabelle hinzu und erstelle Feiertage-Tabelle
ALTER TABLE users ADD COLUMN IF NOT EXISTS bundesland VARCHAR(2) DEFAULT 'BY';

-- Feiertage-Tabelle für Deutschland
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  bundesland VARCHAR(2), -- NULL = bundesweit, sonst Bundesland-Code
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_bundesland ON holidays(bundesland);

-- Bundesweite Feiertage 2025
INSERT INTO holidays (name, date, bundesland) VALUES
('Neujahr', '2025-01-01', NULL),
('Karfreitag', '2025-04-18', NULL),
('Ostermontag', '2025-04-21', NULL),
('Tag der Arbeit', '2025-05-01', NULL),
('Christi Himmelfahrt', '2025-05-29', NULL),
('Pfingstmontag', '2025-06-09', NULL),
('Tag der Deutschen Einheit', '2025-10-03', NULL),
('1. Weihnachtstag', '2025-12-25', NULL),
('2. Weihnachtstag', '2025-12-26', NULL);

-- Bayern (BY) spezifische Feiertage
INSERT INTO holidays (name, date, bundesland) VALUES
('Heilige Drei Könige', '2025-01-06', 'BY'),
('Fronleichnam', '2025-06-19', 'BY'),
('Mariä Himmelfahrt', '2025-08-15', 'BY'),
('Allerheiligen', '2025-11-01', 'BY');

-- Baden-Württemberg (BW) spezifische Feiertage
INSERT INTO holidays (name, date, bundesland) VALUES
('Heilige Drei Könige', '2025-01-06', 'BW'),
('Fronleichnam', '2025-06-19', 'BW'),
('Allerheiligen', '2025-11-01', 'BW');

-- Nordrhein-Westfalen (NW) spezifische Feiertage
INSERT INTO holidays (name, date, bundesland) VALUES
('Fronleichnam', '2025-06-19', 'NW'),
('Allerheiligen', '2025-11-01', 'NW');

-- Weitere Bundesländer können bei Bedarf ergänzt werden
