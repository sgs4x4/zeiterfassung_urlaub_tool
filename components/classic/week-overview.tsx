"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns"
import { de } from "date-fns/locale"
import type { TimeEntry, WeeklySchedule } from "@/lib/db"
import { formatHours } from "@/lib/utils"
import { useTimeEntries } from "@/hooks/queries/use-time-entries"

const WEEKDAY_LABELS = {
  monday: "Mo",
  tuesday: "Di",
  wednesday: "Mi",
  thursday: "Do",
  friday: "Fr",
  saturday: "Sa",
  sunday: "So",
} as const

const WEEKDAY_INDEX_TO_KEY = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
} as const

const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  monday: 8,
  tuesday: 8,
  wednesday: 8,
  thursday: 8,
  friday: 8,
  saturday: 0,
  sunday: 0,
}

export function WeekOverview({
  weeklyHours = 40,
  weeklySchedule,
}: {
  weeklyHours?: number
  weeklySchedule?: WeeklySchedule
}) {
  const schedule = weeklySchedule ?? DEFAULT_WEEKLY_SCHEDULE

  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

  // Geteilter Query-Cache mit der BETA-Ansicht: kein eigenes Polling, kein Event-Bus.
  const { data: entries = [], isLoading } = useTimeEntries(
    format(weekStart, "yyyy-MM-dd"),
    format(weekEnd, "yyyy-MM-dd"),
  )

  const weekData = eachDayOfInterval({ start: weekStart, end: weekEnd }).map((date) => {
    const entry = entries.find((e: TimeEntry) => isSameDay(new Date(e.date), date))
    const weekdayKey = WEEKDAY_INDEX_TO_KEY[date.getDay() as keyof typeof WEEKDAY_INDEX_TO_KEY]
    const target = schedule[weekdayKey] ?? (date.getDay() >= 1 && date.getDay() <= 5 ? weeklyHours / 5 : 0)
    return {
      day: format(date, "EEE", { locale: de }),
      date,
      hours: entry ? Number(entry.hours) : 0,
      target,
    }
  })

  const totalHours = weekData.reduce((sum, day) => sum + day.hours, 0)
  const progress = Math.min((totalHours / weeklyHours) * 100, 100)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Diese Woche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">Lade...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Diese Woche
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-3xl font-bold">{totalHours.toFixed(2)}h</div>
            <div className="text-xs text-muted-foreground">Erfasst</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold">{weeklyHours}h / Woche</div>
          </div>
        </div>

     

        <div className="space-y-3">
          {weekData.map((day) => {
            const dayProgress = day.target > 0 ? Math.min((day.hours / day.target) * 100, 100) : 0
            const isToday = isSameDay(day.date, new Date())
            return (
              <div
                key={day.day}
                className={`flex items-center justify-between ${isToday ? "bg-primary/5 -mx-2 px-2 py-1 rounded" : ""}`}
              >
                <span
                  className={`text-sm font-medium min-w-[40px] ${isToday ? "text-primary" : "text-muted-foreground"}`}
                >
                  {day.day}
                </span>
                <div className="flex-1 mx-3">
                  <Progress value={dayProgress} className="h-1.5" />
                </div>
                <span className="text-sm font-semibold min-w-[48px] text-right">
                  {day.hours > 0 ? formatHours(day.hours) : "-"}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
