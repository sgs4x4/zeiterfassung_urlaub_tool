import { useQuery } from "@tanstack/react-query"
import { getOvertimeTrend, type OvertimeTrendPoint } from "@/app/actions/time-entries"

export const overtimeTrendQueryKey = ["overtime-trend"] as const

export type { OvertimeTrendPoint }

/**
 * Über-/Unterstunden-Verlauf der letzten Monate für die Sparkline.
 * Ein Roundtrip, eine Query – die frühere Variante rief pro Monat eine eigene
 * Server Action auf, die Next.js client-seitig nacheinander abgearbeitet hat.
 */
export function useOvertimeTrend() {
  return useQuery({
    queryKey: overtimeTrendQueryKey,
    queryFn: () => getOvertimeTrend(),
  })
}
