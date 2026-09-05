-- Überstunden-Buchungen (Ledger) + Abwesenheitsart "Überstundenausgleich".
--
-- Bisher gab es für manuelle Eingriffe nur das Einzelfeld users.overtime_baseline_hours
-- (scripts/020). Das hat keine Historie: niemand kann nachvollziehen, wer wann warum wie viele
-- Stunden gutgeschrieben oder gestrichen hat. Für Personal-/Arbeitszeitthemen ist genau das
-- aber die Anforderung (Auszahlung, abgesprochene Streichung, Korrektur nach Prüfung).
--
-- Der Überstunden-Saldo ist ab jetzt:
--   (taggenaues Soll vs. erfasste Zeit)  +  SUM(overtime_adjustments.hours)

CREATE TABLE IF NOT EXISTS overtime_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Tag, an dem die Buchung wirkt (für Monatszuordnung und Sortierung in der Historie).
  effective_date DATE NOT NULL,
  -- Negativ = Abbau (Auszahlung, Freizeitausgleich), positiv = Gutschrift/Korrektur nach oben.
  hours DECIMAL(10,2) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('payout', 'compensation', 'correction', 'opening_balance')),
  reason TEXT,
  -- Bei Freizeitausgleich: die Abwesenheit, aus der die Buchung entstanden ist. ON DELETE CASCADE,
  -- damit ein zurückgezogener/gelöschter Ausgleichsantrag die Abbuchung automatisch mitnimmt.
  absence_id UUID REFERENCES absences(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_overtime_adjustments_user ON overtime_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_overtime_adjustments_date ON overtime_adjustments(user_id, effective_date);
-- Pro Abwesenheit darf es höchstens eine Ausgleichsbuchung geben (Schutz vor Doppelbuchung,
-- z.B. wenn ein Antrag mehrfach genehmigt/erneut genehmigt wird).
CREATE UNIQUE INDEX IF NOT EXISTS idx_overtime_adjustments_absence ON overtime_adjustments(absence_id)
  WHERE absence_id IS NOT NULL;

ALTER TABLE overtime_adjustments ENABLE ROW LEVEL SECURITY;
-- Der Server greift ausschließlich über den Service-Role-Key zu (umgeht RLS). Policy nur als
-- Absicherung, falls die Tabelle je mit einem eingeschränkten Client-Key gelesen wird.
DROP POLICY IF EXISTS "Service role full access" ON overtime_adjustments;
CREATE POLICY "Service role full access" ON overtime_adjustments FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE overtime_adjustments IS 'Nachvollziehbare Buchungen auf das Überstundenkonto (Auszahlung, Freizeitausgleich, Korrektur, Startsaldo). Ersetzt das historienlose Feld users.overtime_baseline_hours.';

-- Bestehende Start-Salden aus scripts/020 als erste Buchung überführen, damit es künftig nur
-- noch EINE Quelle für Saldo-Bewegungen gibt.
INSERT INTO overtime_adjustments (user_id, effective_date, hours, type, reason)
SELECT
  u.id,
  COALESCE(u.overtime_tracking_start_date, CURRENT_DATE),
  u.overtime_baseline_hours,
  'opening_balance',
  'Übernommener Startsaldo (automatisch migriert aus overtime_baseline_hours)'
FROM users u
WHERE COALESCE(u.overtime_baseline_hours, 0) <> 0
  AND NOT EXISTS (
    SELECT 1 FROM overtime_adjustments a
    WHERE a.user_id = u.id AND a.type = 'opening_balance'
  );

-- Feld auf 0 setzen: Der Wert lebt ab jetzt in der Buchungstabelle. Die Spalte selbst bleibt
-- vorerst bestehen (kein Datenverlust bei Rollback), wird vom Code aber nicht mehr gelesen.
UPDATE users SET overtime_baseline_hours = 0 WHERE COALESCE(overtime_baseline_hours, 0) <> 0;

COMMENT ON COLUMN users.overtime_baseline_hours IS 'VERALTET (scripts/021): Start-Salden liegen jetzt als Buchung in overtime_adjustments. Spalte wird vom Code nicht mehr gelesen.';

-- Neue Abwesenheitsart: Überstundenausgleich (Freizeitausgleich). Belastet das Urlaubskontingent
-- nicht (dort wird nur type='vacation' gezählt), reduziert aber wie Urlaub das Tagessoll – der
-- eigentliche Abbau vom Überstundenkonto passiert über eine 'compensation'-Buchung.
ALTER TABLE absences DROP CONSTRAINT IF EXISTS absences_type_check;
ALTER TABLE absences ADD CONSTRAINT absences_type_check
  CHECK (type IN ('vacation', 'sick', 'other', 'overtime_compensation'));
