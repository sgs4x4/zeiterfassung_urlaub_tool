import { useMutation, useQueryClient } from "@tanstack/react-query"
import { closeMonth } from "@/app/actions/month-closure"

export function useCloseMonth() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) => closeMonth(year, month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["month-data"] })
      queryClient.invalidateQueries({ queryKey: ["overtime-balance"] })
      queryClient.invalidateQueries({ queryKey: ["overtime-trend"] })
      queryClient.invalidateQueries({ queryKey: ["unclosed-months"] })
      queryClient.invalidateQueries({ queryKey: ["month-closure-summary"] })
    },
  })
}
