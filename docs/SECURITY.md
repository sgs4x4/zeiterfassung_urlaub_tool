# Sicherheit & Datenschutz – Bestandsaufnahme

Stand: 05.09.2026. Dieses Dokument hält fest, was umgesetzt ist, was bewusst offen bleibt und was
organisatorisch zu klären ist. Es ersetzt keine Rechtsberatung – die datenschutzrechtliche
Bewertung gehört mit eurem Datenschutzbeauftragten abgestimmt.

## Umgesetzt

### Audit-Log (`scripts/024_audit_log.sql`, `lib/audit.ts`)

Administrative Eingriffe werden protokolliert: wer, wann, bei wem, was – mit Vorher/Nachher-Werten.
Erfasst sind:

| Aktion | Warum protokollpflichtig |
| --- | --- |
| `time_entry.update` / `time_entry.delete` | Änderungen an fremden Arbeitszeitnachweisen |
| `month_closure.delete` | Macht einen abgeschlossenen Monat wieder änderbar |
| `overtime.adjustment.create` / `.delete` | Bewegungen auf dem Überstundenkonto (Auszahlung, Streichung) |
| `overtime.tracking_start.update` | Verschiebt, ab wann Überstunden überhaupt zählen |
| `employment.update` | Änderung von Soll-Stunden / Beschäftigungsart |
| `permissions.update`, `user.role.update` | Wer darf künftig fremde Daten sehen |
| `absence.create_for_user`, `absence.status.update` | Abwesenheiten stellvertretend angelegt/entschieden |

Die Tabelle hat bewusst **keine** Update- oder Delete-Policy: Ein Protokoll, das die protokollierte
Person selbst bereinigen kann, ist wertlos. Ein Fehler beim Protokollieren bricht die eigentliche
Aktion nicht ab (sonst legt ein Problem mit der Protokolltabelle die Zeiterfassung lahm), wird aber
serverseitig geloggt.

### Datenminimierung bei Gesundheitsdaten

Krankmeldungen (`absences.type = 'sick'`) sind besondere Kategorien personenbezogener Daten nach
Art. 9 DSGVO. `mapAbsenceRows` (`app/actions/absences.tsx`) liefert für Kalender- und Teamansichten
**keine Freitexte** aus – weder `reason` noch `special_leave_reason`. Kolleginnen und Kollegen
sehen, *dass* jemand abwesend ist, nicht *warum*. Verwaltende Stellen lesen die Freitexte über
`getAllAbsences`.

## Bewusst offen – mit Begründung

### RLS ist derzeit wirkungslos

`lib/supabase/server.ts` verwendet ausschließlich den **Service-Role-Key**, der Row Level Security
umgeht. Die in `scripts/003_create_absences.sql` und `scripts/012` definierten Policies laufen
damit ins Leere. Die gesamte Zugriffskontrolle hängt an Prüfungen im Anwendungscode
(`lib/permissions-server.ts`, `lib/visibility.ts`).

**Risiko:** Eine vergessene Prüfung in einer Server Action ist unmittelbar ein Datenleck – genau
dieser Fehlertyp ist in diesem Projekt schon aufgetreten (Selbst-Ausschluss in
`canActorManageTargetTime`).

**Warum nicht sofort umgebaut:** Ein echter RLS-Betrieb erfordert, dass Supabase die Identität des
angemeldeten Nutzers kennt. Die App authentifiziert aber über NextAuth/Azure AD, nicht über
Supabase Auth – es gibt derzeit kein JWT, gegen das Policies prüfen könnten. Der Umbau bedeutet:
Supabase-JWTs aus der NextAuth-Session signieren, alle Policies neu schreiben und jeden Datenpfad
erneut testen. Das ist ein eigenes Projekt, kein Nebenschritt.

**Empfohlener Zwischenschritt** (deutlich billiger, großer Teil des Nutzens): Jede Server Action
beginnt zwingend mit `requirePermission(...)` oder einer `canActor*`-Prüfung. Das lässt sich mit
einem Lint-Regel- oder Review-Check absichern, statt auf Disziplin zu hoffen.

### Abhängigkeiten

`npm audit` meldet lokal 3 Schwachstellen (1 kritisch, 1 hoch, 1 niedrig). GitHub/Dependabot zählt
auf dem Default-Branch 41, weil dort transitiv über beide Lockfiles gezählt wird.

- **`@auth/core` 0.34.3 (kritisch):** In `lib/auth.ts` ist bereits dokumentiert analysiert und als
  akzeptiertes Risiko eingestuft – die betroffenen Codepfade (DB-Adapter, EmailProvider) werden
  nicht genutzt, es läuft ausschließlich Azure-AD-OAuth. Ein Fix erfordert den Major-Umstieg auf
  next-auth v5. **Diese Einschätzung bleibt gültig, solange kein Adapter oder EmailProvider
  hinzukommt.**
- **Zwei konkurrierende Lockfiles:** `package-lock.json` *und* `pnpm-lock.yaml` sind beide
  versioniert. Damit ist nicht eindeutig, welche Versionen im Deployment tatsächlich installiert
  werden, und Dependabot-Meldungen lassen sich nicht sauber zuordnen. **Empfehlung:** auf einen
  Paketmanager festlegen und das andere Lockfile löschen. Vorher klären, was die Deployment-Pipeline
  (Vercel o.ä.) verwendet.

### Weitere offene Punkte

- **Secret-Rotation:** Der Supabase-Service-Role-Key wurde am 05.09.2026 im Klartext über einen
  Chat übertragen und ist zu rotieren.
- **Hartkodierte Admin-Adressen:** `ADMIN_EMAILS` in `app/actions/absences.tsx` enthält reale
  Klarnamen-Adressen im Quellcode. Gehört in die Datenbank oder in Umgebungsvariablen.
- **Löschkonzept / Aufbewahrung:** Es gibt keine definierten Fristen. Zu klären: Arbeitszeitnachweise
  (§ 16 ArbZG: 2 Jahre), lohnrelevante Unterlagen (steuer-/sozialrechtlich 6–10 Jahre),
  Krankheitsdaten (so kurz wie möglich).
- **Betroffenenrechte:** Kein Selbstbedienungs-Export und kein Löschprozess für Auskunftsersuchen
  (Art. 15/17 DSGVO).
- **Verschlüsselung:** Supabase liefert TLS in-transit und Verschlüsselung at-rest. Zusätzliche
  Spaltenverschlüsselung für Art.-9-Daten bringt wenig, solange der Anwendungsserver den Schlüssel
  ohnehin hält – Zugriffskontrolle, Datenminimierung und Protokollierung wirken hier deutlich mehr.
- **Organisatorisch:** AV-Vertrag mit Supabase, Projekt-Region (EU?), Verzeichnis von
  Verarbeitungstätigkeiten. Falls ein Betriebsrat besteht: Zeiterfassung mit Leistungs- und
  Verhaltenskontrolle ist nach § 87 Abs. 1 Nr. 6 BetrVG mitbestimmungspflichtig – das betrifft
  insbesondere den Überstundensaldo und das erzwingende Monatsabschluss-Modal.
