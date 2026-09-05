import { useQuery } from "@tanstack/react-query"
import { getMyUnclosedMonths } from "@/app/actions/month-closure"

export const unclosedMonthsQueryKey = ["unclosed-months"] as const

/**
 * Alle vergangenen, noch nicht abgeschlossenen Monate des angemeldeten Nutzers – Basis für
 * die Monatsabschluss-Erinnerung (siehe components/dashboard/month-closure-reminder.tsx).
 * Kurzes refetchInterval, damit ein Monat, der gerade "7 Tage überfällig" wird, auch ohne
 * Neuladen der Seite in den blockierenden Zustand wechselt.
 */
export function useUnclosedMonths() {
  return useQuery({
    queryKey: unclosedMonthsQueryKey,
    queryFn: getMyUnclosedMonths,
    refetchInterval: 5 * 60 * 1000,
  })
}
