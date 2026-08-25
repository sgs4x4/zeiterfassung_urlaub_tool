import { useQuery } from "@tanstack/react-query"
import { getWeekBoard } from "@/app/actions/time-entries"

export function weekBoardQueryKey(weekStart: string, weekEnd: string) {
  return ["week-board", weekStart, weekEnd] as const
}

/**
 * Alle Daten einer Woche (Einträge, Projekte, Feiertage, Abschluss-Status) in einem
 * einzigen Server-Action-Roundtrip – Next.js serialisiert Server Actions client-seitig,
 * mehrere parallele Aufrufe hätten sich also gegenseitig blockiert.
 */
export function useWeekBoard(weekStart: string, weekEnd: string) {
  return useQuery({
    queryKey: weekBoardQueryKey(weekStart, weekEnd),
    queryFn: () => getWeekBoard(weekStart, weekEnd),
  })
}
