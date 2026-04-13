-- Mitarbeitertyp und Monatsstunden hinzufügen
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_type VARCHAR(20) DEFAULT 'vollzeit';
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_hours DECIMAL(6,2) DEFAULT 173;

-- Standardwerte basierend auf vorhandenen weekly_hours setzen
UPDATE users SET 
  monthly_hours = CASE 
    WHEN weekly_hours >= 35 THEN 173  -- Vollzeit: ~40h/Woche * 4.33
    WHEN weekly_hours >= 20 THEN weekly_hours * 4.33  -- Teilzeit
    -- Minijob 2026: 603€ / 13,90€ Mindestlohn = 43,4h
    ELSE 43  -- Minijob: ~603€ / 13,90€ Mindestlohn
  END,
  employee_type = CASE 
    WHEN weekly_hours >= 35 THEN 'vollzeit'
    WHEN weekly_hours >= 20 THEN 'teilzeit'
    ELSE 'minijob'
  END;

-- Kommentar für die Typen
COMMENT ON COLUMN users.employee_type IS 'vollzeit, teilzeit, minijob';
COMMENT ON COLUMN users.monthly_hours IS 'Monatliches Stundensoll';
