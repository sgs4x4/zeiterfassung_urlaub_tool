import { useMutation, useQueryClient } from "@tanstack/react-query"
import { saveTimeEntry } from "@/app/actions/time-entries"

/**
 * Ersetzt `timeEntryEvents.emit()` (lib/events.ts) + `router.refresh()`: nach dem
 * Speichern werden gezielt genau die Query-Keys invalidiert, die einen neuen Eintrag
 * betreffen könnten. Jeder Abonnent (TimeEntries, WeekOverview, MonthOverview,
 * OvertimeBadge) aktualisiert sich dadurch automatisch – ohne eigenes Event-Handling
 * pro Komponente und ohne den früheren Bug, dass OvertimeBadge nicht mit-aktualisiert wurde.
 */
export function useSaveTimeEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (formData: FormData) => saveTimeEntry(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["week-board"] })
      queryClient.invalidateQueries({ queryKey: ["month-data"] })
      queryClient.invalidateQueries({ queryKey: ["overtime-balance"] })
      queryClient.invalidateQueries({ queryKey: ["overtime-trend"] })
    },
  })
}
