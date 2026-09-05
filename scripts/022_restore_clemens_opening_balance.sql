-- Einmalige Datenkorrektur: Altsaldo von Clemens erhalten.
--
-- Hintergrund: scripts/020 hat den Überstunden-Trackingbeginn für ALLE Mitarbeitenden auf das
-- Migrationsdatum gesetzt (gewollt: die unvollständigen Monate vor dem Tool-Rollout sollten
-- keine Fehlstunden mehr erzeugen). Für Clemens war die bisherige Historie aber korrekt gepflegt,
-- sein Saldo lag bei +161,06 Std. und soll unverändert bleiben.
--
-- Wichtig: Ein Zurückdatieren des Trackingbeginns würde NICHT wieder 161,06 ergeben – der alte
-- Wert stammt aus der früheren Rechnung (pauschal 173 h/Monat, Urlaub/Krankheit als Fehlstunden,
-- Feiertage ignoriert), während jetzt taggenau gerechnet wird. Der Altsaldo wird deshalb als
-- dokumentierte Eröffnungsbuchung übernommen; ab dem Trackingbeginn rechnet das System sauber weiter.
--
-- VORAUSSETZUNG: scripts/020 und scripts/021 sind eingespielt.

-- 1) Kontrolle vorab: aktueller Stand aller Mitarbeitenden
SELECT
  u.name,
  u.email,
  u.overtime_tracking_start_date AS tracking_ab,
  COALESCE(SUM(a.hours), 0)      AS gebuchte_stunden
FROM users u
LEFT JOIN overtime_adjustments a ON a.user_id = u.id
GROUP BY u.id, u.name, u.email, u.overtime_tracking_start_date
ORDER BY u.name;

-- 2) Eröffnungsbuchung setzen.
--    E-Mail und Stundenwert bei Bedarf anpassen.
--    Der NOT EXISTS-Schutz verhindert eine doppelte Buchung bei erneutem Ausführen.
INSERT INTO overtime_adjustments (user_id, effective_date, hours, type, reason, created_by)
SELECT
  u.id,
  u.overtime_tracking_start_date,
  161.06,
  'opening_balance',
  'Saldo aus der bisherigen Berechnung übernommen (Stand vor Umstellung auf taggenaues Soll)',
  u.id
FROM users u
WHERE u.email = 'clemens.rau@sgs4x4.de'
  AND NOT EXISTS (
    SELECT 1 FROM overtime_adjustments a
    WHERE a.user_id = u.id AND a.type = 'opening_balance'
  );

-- 3) Ergebnis prüfen
SELECT
  u.name,
  a.effective_date,
  a.hours,
  a.type,
  a.reason
FROM overtime_adjustments a
JOIN users u ON u.id = a.user_id
WHERE u.email = 'clemens.rau@sgs4x4.de'
ORDER BY a.effective_date;
