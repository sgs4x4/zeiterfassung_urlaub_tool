"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { ChevronLeft, ChevronRight, Lock, CheckCircle2, Clock } from "lucide-react"
import { cn, formatHours } from "@/lib/utils"
import { isHoliday, type Bundesland } from "@/lib/holidays"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subMonths, addMonths, isWeekend } from "date-fns"
import { de } from "date-fns/locale"
import { useMonthData } from "@/hooks/queries/use-month-data"
import { useCloseMonth } from "@/hooks/queries/use-close-month"

const YEARS = [2024, 2025, 2026]
const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
]

interface MonthOverviewProps {
  bundesland?: Bundesland
  monthlyHours?: number
}

export function MonthOverview({ bundesland = "BY", monthlyHours = 173 }: MonthOverviewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [confirmClose, setConfirmClose] = useState(false)
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const { data, isLoading, isError, error, refetch } = useMonthData(year, month, bundesland)
  const closeMonthMutation = useCloseMonth()

  const entries = data?.entries ?? []
  const holidays = data?.holidays ?? []
  const isClosed = data?.isClosed ?? false
  const canClose = data?.canClose ?? false

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) })
  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0)

  const handleCloseMonth = () => {
    setConfirmClose(false)
    closeMonthMutation.mutate(
      { year, month },
      {
        onSuccess: (result) =>
          toast.success(result.message, {
            description: `E-Mail wurde an ${result.emailRecipients} Admin(s) gesendet.`,
          }),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Fehler beim Abschließen"),
      },
    )
  }

  return (
    <>
      <Card className="overflow-hidden border-border/60 p-0 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 px-5 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">
                {MONTHS[currentDate.getMonth()]} {year}
              </h2>
              {isClosed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Abgeschlossen
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              {totalHours.toFixed(2)} von {monthlyHours} h erfasst
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isClosed && canClose && (
              <Button onClick={() => setConfirmClose(true)} disabled={closeMonthMutation.isPending} size="sm">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {closeMonthMutation.isPending ? "Schließe…" : "Monat abschließen"}
              </Button>
            )}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))} aria-label="Vorheriger Monat">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select
                value={currentDate.getMonth().toString()}
                onValueChange={(v) => setCurrentDate(new Date(year, Number.parseInt(v), 1))}
              >
                <SelectTrigger className="w-[130px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={year.toString()}
                onValueChange={(v) => setCurrentDate(new Date(Number.parseInt(v), currentDate.getMonth(), 1))}
              >
                <SelectTrigger className="w-[92px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))} aria-label="Nächster Monat">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="p-5">
          {isError ? (
            <div className="py-10 text-center text-sm text-destructive">
              <p>Fehler beim Laden: {error instanceof Error ? error.message : "Unbekannter Fehler"}</p>
              <button onClick={() => refetch()} className="mt-2 text-sm underline">
                Erneut versuchen
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
                <div key={day} className="pb-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {day}
                </div>
              ))}

              {isLoading
                ? Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)
                : (
                  <>
                    {Array.from({ length: (startOfMonth(currentDate).getDay() + 6) % 7 }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {daysInMonth.map((day) => {
                      const dayEntries = entries.filter((e) => isSameDay(new Date(e.date), day))
                      const dayHours = dayEntries.reduce((sum, e) => sum + Number(e.hours), 0)
                      const hasEntry = dayHours > 0
                      const isToday = isSameDay(day, new Date())
                      const isHolidayDay = isHoliday(day, holidays)
                      const holidayName = holidays.find((h) => h.date === format(day, "yyyy-MM-dd"))?.name

                      const cell = (
                        <div
                          className={cn(
                            "flex aspect-square flex-col items-center justify-center rounded-lg border border-transparent p-1 transition-colors",
                            isWeekend(day) && "bg-muted/40 text-muted-foreground",
                            isHolidayDay && "bg-primary/[0.07]",
                            hasEntry && !isWeekend(day) && !isHolidayDay && "bg-primary/[0.07]",
                            isToday && "border-primary/60",
                            hasEntry && "cursor-pointer hover:bg-primary/15",
                          )}
                        >
                          <span className={cn("text-sm tabular-nums", isToday && "font-semibold text-primary")}>
                            {format(day, "d")}
                          </span>
                          {hasEntry && (
                            <span className="mt-0.5 text-[11px] font-semibold text-primary tabular-nums">
                              {formatHours(dayHours)}
                            </span>
                          )}
                          {isHolidayDay && !hasEntry && (
                            <span className="mt-0.5 w-full truncate px-0.5 text-center text-[9px] text-primary" title={holidayName}>
                              {holidayName || "Feiertag"}
                            </span>
                          )}
                        </div>
                      )

                      if (!hasEntry) return <div key={day.toISOString()}>{cell}</div>

                      return (
                        <HoverCard key={day.toISOString()} openDelay={100} closeDelay={50}>
                          <HoverCardTrigger asChild>{cell}</HoverCardTrigger>
                          <HoverCardContent className="w-80" side="top">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">{format(day, "EEEE, d. MMMM", { locale: de })}</h4>
                                <span className="text-sm font-semibold text-primary tabular-nums">
                                  {formatHours(dayHours)}
                                </span>
                              </div>
                              <div className="space-y-2">
                                {dayEntries.map((entry) => (
                                  <div key={entry.id} className="space-y-1 rounded-lg bg-muted/50 p-2">
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="font-medium tabular-nums">{formatHours(Number(entry.hours))}</span>
                                      {entry.start_time && entry.end_time && (
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                                          <Clock className="h-3 w-3" />
                                          {entry.start_time.slice(0, 5)}–{entry.end_time.slice(0, 5)}
                                        </span>
                                      )}
                                    </div>
                                    {entry.description && (
                                      <p className="line-clamp-2 text-xs text-muted-foreground">{entry.description}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      )
                    })}
                  </>
                )}
            </div>
          )}
        </div>
      </Card>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Monat {MONTHS[currentDate.getMonth()]} {year} abschließen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Danach können keine Änderungen an diesem Monat mehr vorgenommen werden. Alle Admins erhalten eine
              Benachrichtigung per E-Mail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseMonth}>Abschließen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
