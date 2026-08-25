import { useMutation, useQueryClient } from "@tanstack/react-query"
import { removeTimeEntry, type WeekBoardData } from "@/app/actions/time-entries"

type MonthDataCache = {
  entries: { id: string }[]
  holidays: unknown[]
  isClosed: boolean
  canClose: boolean
}

/**
 * Löscht einen Zeiteintrag optimistisch: der Eintrag verschwindet sofort aus allen
 * betroffenen Caches (Wochen-Board + Monatsübersicht), nicht erst nach dem
 * Server-Roundtrip. Bei einem Fehler wird der vorherige Stand aus dem Snapshot
 * in `onMutate` wiederhergestellt.
 */
export function useDeleteTimeEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (entryId: string) => removeTimeEntry(entryId),
    onMutate: async (entryId: string) => {
      const previousWeekBoards = queryClient.getQueriesData<WeekBoardData | null>({ queryKey: ["week-board"] })
      const previousMonthData = queryClient.getQueriesData<MonthDataCache>({ queryKey: ["month-data"] })

      queryClient.setQueriesData<WeekBoardData | null>({ queryKey: ["week-board"] }, (old) =>
        old ? { ...old, entries: old.entries.filter((entry) => entry.id !== entryId) } : old,
      )
      queryClient.setQueriesData<MonthDataCache>({ queryKey: ["month-data"] }, (old) =>
        old ? { ...old, entries: old.entries.filter((entry) => entry.id !== entryId) } : old,
      )

      return { previousWeekBoards, previousMonthData }
    },
    onError: (_err, _entryId, context) => {
      context?.previousWeekBoards.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data))
      context?.previousMonthData.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["week-board"] })
      queryClient.invalidateQueries({ queryKey: ["month-data"] })
      queryClient.invalidateQueries({ queryKey: ["overtime-balance"] })
      queryClient.invalidateQueries({ queryKey: ["overtime-trend"] })
    },
  })
}
