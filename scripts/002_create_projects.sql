-- Projekte/Kategorien Tabelle
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7), -- Hex color for UI
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für aktive Projekte
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active);

-- RLS Policies für projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Alle können Projekte lesen
CREATE POLICY "Everyone can read active projects"
  ON projects FOR SELECT
  USING (is_active = true);

-- Nur Admins können Projekte erstellen/bearbeiten
CREATE POLICY "Admins can manage projects"
  ON projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.email = current_setting('request.jwt.claims', true)::json->>'email'
      AND users.role = 'admin'
    )
  );

-- Update time_entries um project_id hinzuzufügen
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Migriere bestehende project Namen zu neuer Tabelle (optional)
-- Falls bereits Einträge mit project existieren, könnten wir diese automatisch konvertieren

-- Index für schnellere Abfragen
CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id);

-- Trigger für updated_at
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();

-- Ein paar Standard-Projekte einfügen
INSERT INTO projects (name, description, color, is_active) VALUES
  ('Allgemein', 'Allgemeine Tätigkeiten', '#6B7280', true),
  ('Kundenservice', 'Kundenbetreuung und Support', '#3B82F6', true),
  ('Entwicklung', 'Software-Entwicklung', '#10B981', true),
  ('Administration', 'Administrative Aufgaben', '#F59E0B', true),
  ('Marketing', 'Marketing und Vertrieb', '#EF4444', true)
ON CONFLICT DO NOTHING;
