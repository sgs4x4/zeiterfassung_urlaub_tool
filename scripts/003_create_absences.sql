-- Abwesenheiten-Tabelle (Urlaub, Krankheit, etc.)
CREATE TABLE IF NOT EXISTS absences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('vacation', 'sick', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_absences_user ON absences(user_id);
CREATE INDEX IF NOT EXISTS idx_absences_dates ON absences(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_absences_status ON absences(status);

-- RLS Policies
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;

-- User können ihre eigenen Abwesenheiten sehen
CREATE POLICY "Users can view own absences"
  ON absences FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users
      WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
    )
  );

-- User können eigene Abwesenheiten erstellen
CREATE POLICY "Users can create own absences"
  ON absences FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM users
      WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
    )
  );

-- User können eigene pending Abwesenheiten löschen
CREATE POLICY "Users can delete own pending absences"
  ON absences FOR DELETE
  USING (
    user_id IN (
      SELECT id FROM users
      WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
    )
    AND status = 'pending'
  );

-- Admins können alle Abwesenheiten sehen
CREATE POLICY "Admins can view all absences"
  ON absences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.email = current_setting('request.jwt.claims', true)::json->>'email'
      AND users.role = 'admin'
    )
  );

-- Admins können Abwesenheiten genehmigen/ablehnen
CREATE POLICY "Admins can update absences"
  ON absences FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.email = current_setting('request.jwt.claims', true)::json->>'email'
      AND users.role = 'admin'
    )
  );

-- Trigger für updated_at
CREATE OR REPLACE FUNCTION update_absences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER absences_updated_at
  BEFORE UPDATE ON absences
  FOR EACH ROW
  EXECUTE FUNCTION update_absences_updated_at();

-- Urlaubskontingent zu users hinzufügen
ALTER TABLE users ADD COLUMN IF NOT EXISTS vacation_days_per_year INTEGER DEFAULT 30;
