import { useQuery } from "@tanstack/react-query"
import { getMonthBoard } from "@/app/actions/time-entries"
import type { Bundesland } from "@/lib/holidays"

export function monthDataQueryKey(year: number, month: number, bundesland: Bundesland) {
  return ["month-data", year, month, bundesland] as const
}

/**
 * Monatsübersicht (Einträge, Feiertage, Abschluss-Status) in einem einzigen
 * Server-Action-Roundtrip – Next.js arbeitet Server Actions client-seitig
 * nacheinander ab, mehrere Einzelaufrufe hätten sich gegenseitig blockiert.
 */
export function useMonthData(year: number, month: number, bundesland: Bundesland) {
  return useQuery({
    queryKey: monthDataQueryKey(year, month, bundesland),
    queryFn: async () => {
      const data = await getMonthBoard(year, month)
      return data ?? { entries: [], holidays: [], absences: [], isClosed: false, canClose: false }
    },
  })
}
