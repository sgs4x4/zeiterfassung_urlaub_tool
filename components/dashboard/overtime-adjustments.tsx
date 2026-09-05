"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { getMyOvertimeAdjustments } from "@/app/actions/time-entries"
import { formatHours } from "@/lib/utils"
import { cn } from "@/lib/utils"

const TYPE_LABELS: Record<string, string> = {
  payout: "Auszahlung",
  compensation: "Freizeitausgleich",
  correction: "Korrektur",
  opening_balance: "Startsaldo",
}

/**
 * Die eigenen Buchungen auf dem Überstundenkonto. Der Saldo allein beantwortet nicht, warum er
 * sich verändert hat – hier ist sichtbar, dass etwa ein genehmigter Freizeitausgleich Stunden
 * abgebucht hat.
 */
export function OvertimeAdjustments({ className }: { className?: string }) {
  const { data: adjustments, isLoading } = useQuery({
    queryKey: ["my-overtime-adjustments"],
    queryFn: () => getMyOvertimeAdjustments(5),
  })

  if (isLoading || !adjustments || adjustments.length === 0) return null

  return (
    <div className={cn("space-y-1.5 border-t border-border/60 pt-3", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Letzte Buchungen</p>
      <ul className="space-y-1">
        {adjustments.map((adjustment) => (
          <li key={adjustment.id} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="min-w-0 truncate text-muted-foreground" title={adjustment.reason ?? undefined}>
              {format(new Date(adjustment.effectiveDate), "dd.MM.")}{" "}
              {TYPE_LABELS[adjustment.type] ?? adjustment.type}
            </span>
            <span
              className={cn(
                "shrink-0 font-semibold tabular-nums",
                adjustment.hours < 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {adjustment.hours > 0 ? "+" : ""}
              {formatHours(adjustment.hours)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
