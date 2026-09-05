-- Historisierung von Arbeitsverhältnis-Daten (Beschäftigungsart, Monats-/Wochenstunden,
-- Wochenplan). Bisher wurden diese Werte direkt auf der users-Zeile überschrieben, wodurch
-- Überstunden-/Sollstunden-Berechnungen für VERGANGENE Monate rückwirkend mit dem NEUEN Wert
-- gerechnet wurden, sobald sich ein Arbeitsverhältnis änderte. Diese Tabelle speichert jede
-- Änderung als eigene, zeitlich abgegrenzte Zeile, damit pro Monat immer der Wert verwendet
-- werden kann, der in diesem Monat tatsächlich galt.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS user_employment_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_type VARCHAR(20) NOT NULL,
  monthly_hours DECIMAL(6,2) NOT NULL,
  weekly_hours DECIMAL(4,1) NOT NULL,
  weekly_schedule JSONB NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE, -- NULL = aktuell (noch) gültig
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  CONSTRAINT user_employment_terms_range_valid CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_employment_terms_user ON user_employment_terms(user_id);
CREATE INDEX IF NOT EXISTS idx_employment_terms_user_valid_from ON user_employment_terms(user_id, valid_from);

-- Verhindert überlappende Gültigkeitszeiträume pro Nutzer auf DB-Ebene (Sicherheitsnetz,
-- falls die Zeilen je außerhalb der set_user_employment_terms()-Funktion verändert werden).
ALTER TABLE user_employment_terms
  DROP CONSTRAINT IF EXISTS user_employment_terms_no_overlap;
ALTER TABLE user_employment_terms
  ADD CONSTRAINT user_employment_terms_no_overlap
  EXCLUDE USING gist (
    user_id WITH =,
    daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[]') WITH &&
  );

ALTER TABLE user_employment_terms ENABLE ROW LEVEL SECURITY;
-- Der Server greift ausschließlich über den Service-Role-Key zu (RLS wird dadurch umgangen).
-- Die Policy ist nur Absicherung, falls die Tabelle je mit einem eingeschränkten Client-Key
-- gelesen werden sollte.
DROP POLICY IF EXISTS "Service role full access" ON user_employment_terms;
CREATE POLICY "Service role full access" ON user_employment_terms FOR ALL USING (true) WITH CHECK (true);

-- Backfill: für jeden bestehenden Nutzer eine offene Zeile aus dem aktuellen users-Stand
-- anlegen, gültig "seit jeher" (2000-01-01), damit bereits erfasste Zeiteinträge einen
-- Soll-Wert finden.
INSERT INTO user_employment_terms (user_id, employee_type, monthly_hours, weekly_hours, weekly_schedule, valid_from, valid_to)
SELECT
  u.id,
  COALESCE(u.employee_type, 'vollzeit'),
  COALESCE(u.monthly_hours, 173),
  COALESCE(u.weekly_hours, 40),
  COALESCE(u.weekly_schedule, jsonb_build_object('monday', 8, 'tuesday', 8, 'wednesday', 8, 'thursday', 8, 'friday', 8, 'saturday', 0, 'sunday', 0)),
  '2000-01-01',
  NULL
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_employment_terms t WHERE t.user_id = u.id
);

-- Schreibt eine Arbeitsverhältnis-Änderung atomar: schließt den aktuell offenen Datensatz zum
-- Tag vor "gültig ab" und öffnet einen neuen. Wird derselbe Starttag wie der aktuell offene
-- Datensatz übergeben (z.B. Korrektur am selben Tag), wird die offene Zeile stattdessen in
-- Ort aktualisiert, um keine unnötigen Historieneinträge zu erzeugen. Der denormalisierte
-- "aktuelle Stand" auf users wird nur mitgezogen, wenn die Änderung bereits (heute) gilt –
-- ein für die Zukunft geplanter Wechsel überschreibt den aktuell gültigen Stand noch nicht.
CREATE OR REPLACE FUNCTION set_user_employment_terms(
  p_user_id UUID,
  p_employee_type VARCHAR(20),
  p_monthly_hours DECIMAL(6,2),
  p_weekly_hours DECIMAL(4,1),
  p_weekly_schedule JSONB,
  p_valid_from DATE,
  p_created_by UUID
) RETURNS void AS $$
DECLARE
  v_current_valid_from DATE;
BEGIN
  SELECT valid_from INTO v_current_valid_from
  FROM user_employment_terms
  WHERE user_id = p_user_id AND valid_to IS NULL
  FOR UPDATE;

  IF v_current_valid_from IS NULL THEN
    INSERT INTO user_employment_terms
      (user_id, employee_type, monthly_hours, weekly_hours, weekly_schedule, valid_from, valid_to, created_by)
    VALUES
      (p_user_id, p_employee_type, p_monthly_hours, p_weekly_hours, p_weekly_schedule, p_valid_from, NULL, p_created_by);
  ELSIF p_valid_from < v_current_valid_from THEN
    RAISE EXCEPTION 'Gültig-ab-Datum (%) liegt vor dem Beginn des aktuellen Arbeitsverhältnis-Datensatzes (%)', p_valid_from, v_current_valid_from;
  ELSIF p_valid_from = v_current_valid_from THEN
    UPDATE user_employment_terms
    SET employee_type = p_employee_type,
        monthly_hours = p_monthly_hours,
        weekly_hours = p_weekly_hours,
        weekly_schedule = p_weekly_schedule,
        created_by = p_created_by,
        created_at = NOW()
    WHERE user_id = p_user_id AND valid_to IS NULL;
  ELSE
    UPDATE user_employment_terms
    SET valid_to = p_valid_from - INTERVAL '1 day'
    WHERE user_id = p_user_id AND valid_to IS NULL;

    INSERT INTO user_employment_terms
      (user_id, employee_type, monthly_hours, weekly_hours, weekly_schedule, valid_from, valid_to, created_by)
    VALUES
      (p_user_id, p_employee_type, p_monthly_hours, p_weekly_hours, p_weekly_schedule, p_valid_from, NULL, p_created_by);
  END IF;

  IF p_valid_from <= CURRENT_DATE THEN
    UPDATE users
    SET employee_type = p_employee_type,
        monthly_hours = p_monthly_hours,
        weekly_hours = p_weekly_hours,
        weekly_schedule = p_weekly_schedule
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE user_employment_terms IS 'Historisierte Arbeitsverhältnis-Zeiträume je Nutzer (Beschäftigungsart, Soll-Stunden, Wochenplan). Genutzt von getMonthlyTargetHours(), damit Überstunden pro Monat mit dem damals gültigen Soll gerechnet werden.';
COMMENT ON FUNCTION set_user_employment_terms IS 'Einziger erlaubter Schreibpfad für Arbeitsverhältnis-Änderungen: schließt/öffnet Historienzeilen atomar und hält users.* als aktuellen Stand synchron.';
