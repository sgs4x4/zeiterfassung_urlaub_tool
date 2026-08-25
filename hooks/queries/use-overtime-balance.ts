import { useQuery } from "@tanstack/react-query"
import { getOvertimeBalance } from "@/app/actions/time-entries"

export const overtimeBalanceQueryKey = ["overtime-balance"] as const

export function useOvertimeBalance() {
  return useQuery({
    queryKey: overtimeBalanceQueryKey,
    queryFn: () => getOvertimeBalance(),
  })
}
