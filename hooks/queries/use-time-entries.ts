import { useQuery } from "@tanstack/react-query"
import { getMyTimeEntries } from "@/app/actions/time-entries"

export function timeEntriesQueryKey(startDate: string, endDate: string) {
  return ["time-entries", startDate, endDate] as const
}

/**
 * Zeiteinträge eines Zeitraums – wird nur von der klassischen Ansicht
 * (components/classic/) genutzt. Die BETA-Ansicht holt ihre Wochendaten
 * gebündelt über `useWeekBoard`.
 */
export function useTimeEntries(startDate: string, endDate: string) {
  return useQuery({
    queryKey: timeEntriesQueryKey(startDate, endDate),
    queryFn: () => getMyTimeEntries(startDate, endDate),
  })
}
