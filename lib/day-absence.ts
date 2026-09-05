import { ABSENCE_TYPE_LABELS, type AbsenceType } from "@/lib/absence-types"

export type DayAbsenceLike = {
  start_date: string
  end_date: string
  type: AbsenceType
  status: "pending" | "approved" | "rejected"
  day_part: "full" | "half_am" | "half_pm"
}

export type ResolvedDayAbsence = {
  type: AbsenceType
  label: string
  status: "pending" | "approved" | "rejected"
  /** Anteil des Tages, der abwesend ist: 1 = ganztägig, 0.5 = halber Tag. */
  portion: number
  isPending: boolean
}

/**
 * Findet die Abwesenheit, die auf einen bestimmten Tag fällt – für die Anzeige im Wochen- und
 * Monatsboard. Damit ist im Buchungsbereich sichtbar, warum an einem Tag kein oder nur ein
 * halbes Soll steht.
 */
export function resolveDayAbsence(dateStr: string, absences: DayAbsenceLike[]): ResolvedDayAbsence | null {
  const match = absences.find((a) => a.start_date <= dateStr && a.end_date >= dateStr)
  if (!match) return null

  const isHalfDay = match.day_part !== "full" && match.start_date === match.end_date

  return {
    type: match.type,
    label: ABSENCE_TYPE_LABELS[match.type] ?? "Abwesend",
    status: match.status,
    portion: isHalfDay ? 0.5 : 1,
    isPending: match.status === "pending",
  }
}

/** Farbgebung pro Abwesenheitsart, einheitlich mit dem Urlaubskalender. */
export const ABSENCE_TYPE_STYLES: Record<AbsenceType, string> = {
  vacation: "text-blue-600 dark:text-blue-400",
  sick: "text-red-600 dark:text-red-400",
  special_leave: "text-purple-600 dark:text-purple-400",
  unpaid_leave: "text-slate-600 dark:text-slate-400",
  overtime_compensation: "text-teal-600 dark:text-teal-400",
  other: "text-amber-600 dark:text-amber-400",
}
