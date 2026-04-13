"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { getMyTimeEntries } from "@/app/actions/time-entries"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns"
import { de } from "date-fns/locale"
import type { TimeEntry } from "@/lib/db"
import { useRouter } from "next/navigation"
import { timeEntryEvents } from "@/lib/events"

const DAILY_TARGET = 8

export function WeekOverview({ weeklyHours = 40 }: { weeklyHours?: number }) {
  const router = useRouter()
  const [weekData, setWeekData] = useState<{ day: string; date: Date; hours: number }[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadWeekData = async () => {
    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

    const entries = await getMyTimeEntries(format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd"))

    const days = eachDayOfInterval({ start: weekStart, end: weekEnd }).slice(0, 5) // Mo-Fr
    const data = days.map((date) => {
      const entry = entries.find((e: TimeEntry) => isSameDay(new Date(e.date), date))
      return {
        day: format(date, "EEE", { locale: de }),
        date,
        hours: entry ? Number(entry.hours) : 0,
      }
    })

    setWeekData(data)
    setIsLoading(false)
  }

  useEffect(() => {
    loadWeekData()

    // Subscribe to time entry events for instant updates
    const unsubscribe = timeEntryEvents.subscribe(() => {
      loadWeekData()
    })

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadWeekData()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Poll for updates every 30 seconds when tab is visible (fallback)
    const interval = setInterval(() => {
      if (!document.hidden) {
        loadWeekData()
      }
    }, 30000)

    return () => {
      unsubscribe()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      clearInterval(interval)
    }
  }, [])

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
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold">{totalHours.toFixed(2)}h</span>
            <span className="text-sm text-muted-foreground">von {weeklyHours}h</span>
          </div>
          <Progress value={progress} className="h-2" />
          {totalHours >= weeklyHours && <p className="text-xs text-green-500">Wochenziel erreicht!</p>}
        </div>

        <div className="space-y-3">
          {weekData.map((day) => {
            const dayProgress = Math.min((day.hours / DAILY_TARGET) * 100, 100)
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
                  {day.hours > 0 ? `${day.hours.toFixed(2)}h` : "-"}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
