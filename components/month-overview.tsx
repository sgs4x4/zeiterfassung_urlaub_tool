"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarDays, ChevronLeft, ChevronRight, Lock, CheckCircle2, Clock } from "lucide-react"
import { getMyTimeEntries } from "@/app/actions/time-entries"
import { getHolidaysForYear } from "@/app/actions/holidays"
import { closeMonth, canCloseMonth, isMonthClosed } from "@/app/actions/month-closure"
import type { TimeEntry } from "@/lib/db"
import { cn, formatHours } from "@/lib/utils"
import { isHoliday, type Bundesland, type Holiday } from "@/lib/holidays"
import { timeEntryEvents } from "@/lib/events"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  subMonths,
  addMonths,
  isWeekend,
} from "date-fns"
import { de } from "date-fns/locale"

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
  monthlyHours?: number // Neu: Monatsstunden statt Wochenstunden
}

export function MonthOverview({ bundesland = "BY", monthlyHours = 173 }: MonthOverviewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isClosed, setIsClosed] = useState(false)
  const [canClose, setCanClose] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const loadEntries = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const start = format(startOfMonth(currentDate), "yyyy-MM-dd")
      const end = format(endOfMonth(currentDate), "yyyy-MM-dd")
      const data = await getMyTimeEntries(start, end)
      setEntries(data)

      const holidayData = await getHolidaysForYear(currentDate.getFullYear(), bundesland)
      setHolidays(holidayData)

      const closed = await isMonthClosed(currentDate.getFullYear(), currentDate.getMonth() + 1)
      setIsClosed(closed)

      const closeable = await canCloseMonth(currentDate.getFullYear(), currentDate.getMonth() + 1)
      setCanClose(closeable)
    } catch (err) {
      console.error("[v0] MonthOverview error:", err)
      setError(err instanceof Error ? err.message : "Fehler beim Laden")
    } finally {
      setIsLoading(false)
    }
  }, [currentDate, bundesland])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  // Subscribe to time entry events for instant updates
  useEffect(() => {
    const unsubscribe = timeEntryEvents.subscribe(() => {
      loadEntries()
    })
    return unsubscribe
  }, [loadEntries])

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  })

  const getHoursForDay = (day: Date) => {
    const dayEntries = entries.filter((e) => isSameDay(new Date(e.date), day))
    return dayEntries.reduce((sum, e) => sum + Number(e.hours), 0)
  }

  const getEntriesForDay = (day: Date) => {
    return entries.filter((e) => isSameDay(new Date(e.date), day))
  }

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0)

  const expectedHours = monthlyHours

  const handleCloseMonth = async () => {
    if (
      !confirm(
        `Möchten Sie den Monat ${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()} wirklich abschließen? Danach können keine Änderungen mehr vorgenommen werden.`,
      )
    ) {
      return
    }

    setIsClosing(true)
    try {
      const result = await closeMonth(currentDate.getFullYear(), currentDate.getMonth() + 1)
      alert(`${result.message}\n\nEmail wurde an ${result.emailRecipients} Admin(s) gesendet.`)
      await loadEntries()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Fehler beim Abschließen")
    } finally {
      setIsClosing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Monatsübersicht
            {isClosed && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium">
                <Lock className="h-3 w-3" />
                Abgeschlossen
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {!isClosed && canClose && (
              <Button
                onClick={handleCloseMonth}
                disabled={isClosing}
                size="sm"
                className="bg-primary/90 hover:bg-primary"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {isClosing ? "Schließe..." : "Monat abschließen"}
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select
              value={currentDate.getMonth().toString()}
              onValueChange={(v) => setCurrentDate(new Date(currentDate.getFullYear(), Number.parseInt(v), 1))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={currentDate.getFullYear().toString()}
              onValueChange={(v) => setCurrentDate(new Date(Number.parseInt(v), currentDate.getMonth(), 1))}
            >
              <SelectTrigger className="w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Statistik */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold">{totalHours.toFixed(2)}h</div>
            <div className="text-xs text-muted-foreground">Erfasst</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{expectedHours}h</div>
            <div className="text-xs text-muted-foreground">Monatssoll</div>
          </div>
          <div className="text-center">
            <div
              className={cn("text-2xl font-bold", totalHours >= expectedHours ? "text-green-500" : "text-orange-500")}
            >
              {(totalHours - expectedHours).toFixed(2)}h
            </div>
            <div className="text-xs text-muted-foreground">Differenz</div>
          </div>
        </div>

        {/* Kalender */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Lade...</div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            <p>Fehler beim Laden: {error}</p>
            <button onClick={loadEntries} className="text-sm underline mt-2">
              Erneut versuchen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
            {/* Leere Zellen für Offset */}
            {Array.from({ length: (startOfMonth(currentDate).getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {daysInMonth.map((day) => {
              const dayHours = getHoursForDay(day)
              const dayEntries = getEntriesForDay(day)
              const hasEntry = dayHours > 0
              const isWeekendDay = isWeekend(day)
              const isToday = isSameDay(day, new Date())
              const isHolidayDay = isHoliday(day, holidays)
              const holidayName = holidays.find((h) => h.date === format(day, "yyyy-MM-dd"))?.name

              const dayContent = (
                <div
                  className={cn(
                    "relative p-2 text-center rounded-md border border-transparent cursor-default transition-colors",
                    isWeekendDay && "bg-muted/30 text-muted-foreground",
                    isHolidayDay && "bg-primary/20 text-primary",
                    isToday && "border-primary ring-2 ring-primary/20",
                    hasEntry && !isWeekendDay && !isHolidayDay && "bg-primary/10",
                    hasEntry && "hover:bg-primary/20 cursor-pointer"
                  )}
                >
                  <div className={cn("text-sm", isToday && "font-bold text-primary")}>{format(day, "d")}</div>
                  {hasEntry && <div className="text-xs font-semibold text-primary mt-0.5">{formatHours(dayHours)}</div>}
                  {isHolidayDay && !hasEntry && (
                    <div className="text-[10px] font-medium text-primary mt-0.5">Feiertag</div>
                  )}
                </div>
              )

              if (hasEntry) {
                return (
                  <HoverCard key={day.toISOString()} openDelay={100} closeDelay={50}>
                    <HoverCardTrigger asChild>
                      {dayContent}
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80" side="top">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">
                            {format(day, "EEEE, d. MMMM", { locale: de })}
                          </h4>
                          <span className="text-sm font-bold text-primary">{formatHours(dayHours)}</span>
                        </div>
                        <div className="space-y-2">
                          {dayEntries.map((entry) => (
                            <div key={entry.id} className="p-2 rounded-md bg-muted/50 space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">{formatHours(Number(entry.hours))}</span>
                                {entry.start_time && entry.end_time && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}
                                  </span>
                                )}
                              </div>
                              {entry.project_name && (
                                <div className="text-xs text-primary font-medium">{entry.project_name}</div>
                              )}
                              {entry.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{entry.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                )
              }

              return (
                <div key={day.toISOString()}>
                  {dayContent}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
