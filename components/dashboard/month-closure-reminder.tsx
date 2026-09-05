"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertTriangle, CalendarClock } from "lucide-react"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import { useUnclosedMonths } from "@/hooks/queries/use-unclosed-months"
import { useMonthClosureSummary } from "@/hooks/queries/use-month-closure-summary"
import { useCloseMonth } from "@/hooks/queries/use-close-month"
import { formatHours } from "@/lib/utils"

/**
 * Erinnert an noch offene, abschließbare Monate (ältester zuerst). Solange der Monat weniger
 * als 7 Tage überfällig ist, kann die Erinnerung vertagt werden ("Später"). Ab 7 Tagen
 * überfällig wird sie blockierend (kein Abbrechen, kein Escape) und zwingt zum Abschluss –
 * danach rutscht automatisch der nächste offene Monat nach, bis keiner mehr übrig ist.
 *
 * Wird einmal pro Dashboard (klassische + Beta-Ansicht) gemountet, siehe app/dashboard/page.tsx.
 */
export function MonthClosureReminder() {
  const { data: unclosedMonths } = useUnclosedMonths()
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)

  const current = unclosedMonths?.[0]
  const currentKey = current ? `${current.year}-${current.month}` : null

  const summary = useMonthClosureSummary(current?.year, current?.month)
  const closeMonthMutation = useCloseMonth()

  // Sobald sich der "älteste offene Monat" ändert (z.B. nach erfolgreichem Abschluss), ist eine
  // frühere "Später"-Vertagung nicht mehr gültig – sonst würde der NÄCHSTE Monat automatisch
  // mit-vertagt, ohne dass der Nutzer ihn je gesehen hat.
  useEffect(() => {
    if (dismissedKey && dismissedKey !== currentKey) {
      setDismissedKey(null)
    }
  }, [currentKey, dismissedKey])

  if (!current || currentKey === dismissedKey) {
    return null
  }

  const isBlocking = current.isBlocking
  const monthLabel = format(new Date(current.year, current.month - 1, 1), "MMMM yyyy", { locale: de })
  const remaining = (unclosedMonths?.length ?? 1) - 1

  const handleClose = () => {
    closeMonthMutation.mutate(
      { year: current.year, month: current.month },
      {
        onSuccess: (result) => {
          toast.success(result.message)
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Fehler beim Abschließen")
        },
      },
    )
  }

  return (
    <AlertDialog open onOpenChange={() => {}}>
      <AlertDialogContent
        onEscapeKeyDown={(e) => {
          if (isBlocking) e.preventDefault()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isBlocking ? (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            ) : (
              <CalendarClock className="h-5 w-5 text-primary" />
            )}
            {isBlocking ? "Monatsabschluss überfällig" : "Monatsabschluss ausstehend"}: {monthLabel}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <p>
                {isBlocking
                  ? `Dieser Monat ist seit ${current.daysOverdue} Tagen überfällig (mehr als 7 Tage seit Monatsende). Du musst ihn jetzt abschließen, um fortzufahren.`
                  : "Der Monat ist vorbei und kann abgeschlossen werden. Bitte schließe ihn zeitnah ab."}
              </p>
              {summary.data && (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">
                  Erfasst: <strong>{formatHours(summary.data.totalHours)}</strong> · Soll:{" "}
                  <strong>{formatHours(summary.data.expectedHours)}</strong> ·{" "}
                  {summary.data.overtime >= 0 ? "+" : ""}
                  {formatHours(summary.data.overtime)} {summary.data.overtime >= 0 ? "Überstunden" : "Fehlstunden"}
                </p>
              )}
              {remaining > 0 && (
                <p className="text-xs text-muted-foreground">
                  {remaining === 1
                    ? "Danach ist noch 1 weiterer Monat offen."
                    : `Danach sind noch ${remaining} weitere Monate offen.`}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Nach dem Abschluss können keine Änderungen an diesem Monat mehr vorgenommen werden. Alle Admins
                erhalten eine Benachrichtigung per E-Mail.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {!isBlocking && (
            <AlertDialogCancel onClick={() => setDismissedKey(currentKey)}>Später</AlertDialogCancel>
          )}
          <AlertDialogAction onClick={handleClose} disabled={closeMonthMutation.isPending}>
            {closeMonthMutation.isPending ? "Schließe…" : "Jetzt abschließen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
