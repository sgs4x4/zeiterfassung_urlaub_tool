-- Revisionssichere Protokollierung administrativer Eingriffe.
--
-- Bisher konnten Admins fremde Zeiteinträge ändern und löschen, Monatsabschlüsse entfernen,
-- Überstunden buchen und Rechte vergeben – ohne jede Spur. Für ein Zeiterfassungssystem ist das
-- der kritischste offene Punkt: arbeitsrechtlich (Manipulationsverdacht an Arbeitszeitnachweisen)
-- und datenschutzrechtlich (Rechenschaftspflicht, Art. 5 Abs. 2 DSGVO).
--
-- Protokolliert wird, WER WANN WAS bei WEM geändert hat – bewusst inklusive der alten und neuen
-- Werte, damit eine Änderung nachvollzogen und im Zweifel rekonstruiert werden kann.

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Wer hat gehandelt (NULL nur, falls der Account später gelöscht wird).
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_email TEXT,
  -- Wessen Daten waren betroffen.
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Was wurde getan, z.B. 'time_entry.update', 'month_closure.delete', 'permissions.update'.
  action TEXT NOT NULL,
  -- Betroffener Datensatz (Tabelle + ID), damit man vom Eintrag zurückspringen kann.
  entity_type TEXT,
  entity_id TEXT,
  -- Vorher/Nachher als JSON. Bewusst schlank halten: nur die geänderten Felder.
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action, created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Das Protokoll darf nicht nachträglich verändert werden. Der Server schreibt mit dem
-- Service-Role-Key (umgeht RLS), für alle anderen Rollen gibt es bewusst KEINE Update-/Delete-
-- Policy – ein Audit-Log, das der Protokollierte selbst bereinigen kann, ist wertlos.
DROP POLICY IF EXISTS "Audit log is read-only" ON audit_log;
CREATE POLICY "Audit log is read-only" ON audit_log FOR SELECT USING (true);

COMMENT ON TABLE audit_log IS 'Protokoll administrativer Eingriffe (Zeiteinträge, Monatsabschlüsse, Überstunden, Rechte, Stammdaten). Nur Anhängen und Lesen – keine Update-/Delete-Policy.';
