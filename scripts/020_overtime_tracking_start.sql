-- "Ab wann zählt die Zeiterfassung für den Überstunden-Saldo" pro Mitarbeiter. Getrennt von
-- der Arbeitsverhältnis-Historie (user_employment_terms, scripts/019): ein Mitarbeiter kann
-- seit Jahren mit z.B. 173h/Monat angestellt sein, aber dieses Tool erst kürzlich (unternehmensweit
-- oder individuell) für die Zeiterfassung nutzen. Ohne diese Grenze wurden Monate VOR dem
-- eigentlichen Rollout mit dem vollen Monats-Soll verglichen, obwohl darin kaum/gar nicht im
-- Tool erfasst wurde – das erzeugte riesige, fachlich falsche Minusstunden direkt nach dem
-- unternehmensweiten Start (Rollout mitten im Jahr).
--
-- DEFAULT CURRENT_DATE setzt für ALLE bereits bestehenden Zeilen (Backfill beim Anlegen der
-- Spalte) und künftige Neuanlagen den Start auf HEUTE – die komplette Vorgeschichte zählt damit
-- ab sofort nicht mehr für den Saldo (Saldo = 0 bei Einspielen dieser Migration). Mitarbeitende
-- mit tatsächlich korrekt durchgängig gepflegter Historie können ihr eigenes Datum danach im
-- Admin-Bereich ("Überstunden-Basis") auf den echten Startzeitpunkt zurücksetzen, um ihre
-- bisherige Historie weiter zu berücksichtigen.
ALTER TABLE users ADD COLUMN IF NOT EXISTS overtime_tracking_start_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Manueller Start-Saldo (Std.), z.B. übernommen aus einem Vorgängersystem/einer Excel-Liste.
-- Wird einmalig zum berechneten Saldo addiert (siehe getOvertimeBalance in lib/db.ts).
ALTER TABLE users ADD COLUMN IF NOT EXISTS overtime_baseline_hours DECIMAL(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.overtime_tracking_start_date IS 'Ab diesem Datum zählen Monate für den Überstunden-Saldo (getOvertimeBalance/getMonthlyOvertime/getOvertimeTrend/Monatsabschluss-Reminder). Alles davor wird ignoriert, um unvollständige Alt-/Rollout-Daten nicht als Fehlstunden zu werten.';
COMMENT ON COLUMN users.overtime_baseline_hours IS 'Manueller Start-Saldo (z.B. aus einem Vorgängersystem übernommen), wird einmalig zum berechneten Saldo addiert.';
