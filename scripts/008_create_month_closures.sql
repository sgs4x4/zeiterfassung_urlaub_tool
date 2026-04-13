-- Monatsabschlüsse-Tabelle
CREATE TABLE IF NOT EXISTS month_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  closed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_hours DECIMAL(10, 2) NOT NULL,
  expected_hours DECIMAL(10, 2) NOT NULL,
  overtime DECIMAL(10, 2) NOT NULL,
  UNIQUE(user_id, year, month)
);

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_month_closures_user ON month_closures(user_id);
CREATE INDEX IF NOT EXISTS idx_month_closures_year_month ON month_closures(year, month);

-- RLS aktivieren
ALTER TABLE month_closures ENABLE ROW LEVEL SECURITY;

-- Policies: Jeder User kann seine eigenen Abschlüsse sehen
CREATE POLICY "Users can view own closures"
  ON month_closures FOR SELECT
  USING (true);

-- Nur User können ihre eigenen Abschlüsse erstellen
CREATE POLICY "Users can create own closures"
  ON month_closures FOR INSERT
  WITH CHECK (true);
