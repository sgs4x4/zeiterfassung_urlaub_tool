import { useQuery } from "@tanstack/react-query"
import { getMonthClosureSummary } from "@/app/actions/month-closure"

export function monthClosureSummaryQueryKey(year: number, month: number) {
  return ["month-closure-summary", year, month] as const
}

/** Stunden-Zusammenfassung eines einzelnen Monats, nur geladen wenn Jahr/Monat bekannt sind. */
export function useMonthClosureSummary(year: number | undefined, month: number | undefined) {
  return useQuery({
    queryKey: monthClosureSummaryQueryKey(year ?? 0, month ?? 0),
    queryFn: () => getMonthClosureSummary(year as number, month as number),
    enabled: year !== undefined && month !== undefined,
  })
}
