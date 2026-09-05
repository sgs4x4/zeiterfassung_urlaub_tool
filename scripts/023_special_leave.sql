-- Sonderurlaub als eigene Abwesenheitsart.
--
-- Bisher gab es nur 'vacation' | 'sick' | 'other' (+ 'overtime_compensation' aus scripts/021).
-- Sonderurlaub (Hochzeit, Umzug, Todesfall, Kind krank, unbezahlter Urlaub …) landete damit
-- entweder fälschlich als 'vacation' – und wurde dann vom Urlaubskontingent abgezogen, obwohl er
-- zusätzlich gewährt wird – oder unspezifisch als 'other' ohne erkennbaren Grund.
--
-- 'special_leave'  = bezahlter Sonderurlaub: reduziert wie Urlaub das Tagessoll, belastet aber
--                    das Urlaubskontingent NICHT (dort zählt weiterhin nur type='vacation').
-- 'unpaid_leave'   = unbezahlte Freistellung: reduziert ebenfalls das Tagessoll (es besteht keine
--                    Arbeitspflicht), belastet weder Kontingent noch Überstundenkonto.
ALTER TABLE absences DROP CONSTRAINT IF EXISTS absences_type_check;
ALTER TABLE absences ADD CONSTRAINT absences_type_check
  CHECK (type IN ('vacation', 'sick', 'other', 'overtime_compensation', 'special_leave', 'unpaid_leave'));

-- Freitext für den konkreten Anlass des Sonderurlaubs (z.B. "Umzug", "Hochzeit").
-- Bewusst getrennt von 'reason': dort steht die Begründung des Antragstellers, hier die
-- arbeitsrechtliche Kategorie für Auswertungen.
ALTER TABLE absences ADD COLUMN IF NOT EXISTS special_leave_reason TEXT;

-- Wer die Abwesenheit angelegt hat. NULL = vom Mitarbeitenden selbst beantragt,
-- gesetzt = stellvertretend durch eine Administratorin/einen Administrator eingetragen.
ALTER TABLE absences ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN absences.special_leave_reason IS 'Anlass bei Sonderurlaub (Hochzeit, Umzug, Pflege …) – für Auswertungen, unabhängig vom Freitext in reason.';
COMMENT ON COLUMN absences.created_by IS 'NULL = selbst beantragt; gesetzt = stellvertretend durch Admin angelegt.';
