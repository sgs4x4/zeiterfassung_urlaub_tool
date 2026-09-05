/**
 * Abwesenheitsarten und ihre Beschriftungen.
 *
 * Bewusst hier und nicht in app/actions/absences.tsx: Dateien mit "use server" dürfen
 * ausschließlich async Funktionen exportieren – Konstanten und Typen führen dort zu einem
 * Laufzeitfehler ("A 'use server' file can only export async functions"). Zudem brauchen auch
 * Client-Komponenten diese Werte, ohne die Server Actions zu importieren.
 */

export type AbsenceType =
  | "vacation"
  | "sick"
  | "other"
  | "overtime_compensation"
  | "special_leave"
  | "unpaid_leave"

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  vacation: "Urlaub",
  sick: "Krankheit",
  special_leave: "Sonderurlaub",
  unpaid_leave: "Unbezahlte Freistellung",
  overtime_compensation: "Überstundenausgleich",
  other: "Sonstiges",
}

/**
 * Arten, die das Urlaubskontingent NICHT belasten. Sie reduzieren zwar wie Urlaub das taggenaue
 * Soll (es besteht keine Arbeitspflicht), werden aber nicht gegen die Urlaubstage gerechnet –
 * siehe getVacationBalance und getAdminDashboardData, die nur type='vacation' zählen.
 */
export const NON_VACATION_ABSENCE_TYPES: AbsenceType[] = [
  "sick",
  "other",
  "overtime_compensation",
  "special_leave",
  "unpaid_leave",
]

/** Arten, bei denen ein halber Tag fachlich sinnvoll ist (Krankheit wird tageweise erfasst). */
export const HALF_DAY_ABSENCE_TYPES: AbsenceType[] = ["vacation", "special_leave", "overtime_compensation"]
