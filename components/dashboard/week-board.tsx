"use client"

import { useState } from "react"
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  getISOWeek,
  isSameDay,
  isSameMonth,
  startOfWeek,
  subWeeks,
} from "date-fns"
import { de } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Lock, Plane, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatHours } from "@/lib/utils"
import { useWeekBoard } from "@/hooks/queries/use-week-board"
import type { WeeklySchedule } from "@/lib/db"
import type { WeekBoardData } from "@/app/actions/time-entries"
import { ABSENCE_TYPE_STYLES, resolveDayAbsence } from "@/lib/day-absence"
import { EntryDialog } from "./entry-dialog"

const WEEKDAY_INDEX_TO_KEY = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
} as const

type BoardEntry = WeekBoardData["entries"][number]

interface WeekBoardProps {
  weeklySchedule: WeeklySchedule
  weeklyHours: number
}

export function WeekBoard({ weeklySchedule, weeklyHours }: WeekBoardProps) {
  const [anchor, setAnchor] = useState(() => new Date())
  const [dialog, setDialog] = useState<{ date: Date; entry?: BoardEntry } | null>(null)

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 })
  const weekStartISO = format(weekStart, "yyyy-MM-dd")
  const weekEndISO = format(weekEnd, "yyyy-MM-dd")

  const { data, isLoading } = useWeekBoard(weekStartISO, weekEndISO)

  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const entries = data?.entries ?? []
  const holidays = data?.holidays ?? []
  const absences = data?.absences ?? []
  const closedMonths = data?.closedMonths ?? []
  const editableFrom = data?.editableFrom ? new Date(data.editableFrom) : null

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0)
  const weekProgress = weeklyHours > 0 ? Math.min((totalHours / weeklyHours) * 100, 100) : 0
  const isCurrentWeek = isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 1 }))

  const targetFor = (day: Date) => weeklySchedule[WEEKDAY_INDEX_TO_KEY[day.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6]] ?? 0

  const isDayEditable = (day: Date) => {
    if (closedMonths.includes(format(day, "yyyy-MM"))) return false
    if (!editableFrom) return true
    return day >= editableFrom
  }

  return (
    <>
      <Card className="overflow-hidden border-border/60 p-0 shadow-sm">
        {/* Kopfzeile: Woche, Fortschritt, Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 px-5 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">KW {getISOWeek(weekStart)}</h2>
              {isCurrentWeek && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  Aktuelle Woche
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {format(weekStart, "d.", { locale: de })}
              {!isSameMonth(weekStart, weekEnd) && format(weekStart, " MMM", { locale: de })} –{" "}
              {format(weekEnd, "d. MMMM yyyy", { locale: de })}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden min-w-[180px] sm:block">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-2xl font-semibold tabular-nums">{totalHours.toFixed(2)}</span>
                <span className="text-sm text-muted-foreground tabular-nums">/ {weeklyHours} h</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${weekProgress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setAnchor(subWeeks(anchor, 1))} aria-label="Vorherige Woche">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAnchor(new Date())}
                disabled={isCurrentWeek}
                className="text-xs font-medium"
              >
                Heute
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setAnchor(addWeeks(anchor, 1))} aria-label="Nächste Woche">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* 7-Spalten-Board */}
        <div className="grid grid-cols-1 divide-y divide-border/60 md:grid-cols-7 md:divide-x md:divide-y-0">
          {days.map((day) => {
            const dayEntries = entries.filter((e) => isSameDay(new Date(e.date), day))
            const dayHours = dayEntries.reduce((sum, e) => sum + Number(e.hours), 0)
            const target = targetFor(day)
            const isToday = isSameDay(day, new Date())
            const holiday = holidays.find((h) => h.date === format(day, "yyyy-MM-dd"))
            const absence = resolveDayAbsence(format(day, "yyyy-MM-dd"), absences)
            const isOffDay = target === 0
            const editable = isDayEditable(day)
            const isComplete = target > 0 && dayHours >= target

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "group/day flex min-h-[220px] flex-col transition-colors",
                  isOffDay && "bg-muted/30",
                  holiday && "bg-primary/[0.04]",
                  absence && !absence.isPending && "bg-accent/40",
                  isToday && "bg-primary/[0.06]",
                )}
              >
                {/* Tageskopf */}
                <div className="px-3 pt-3 pb-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-wide",
                        isToday ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {format(day, "EEE", { locale: de })}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        isToday ? "text-primary" : "text-foreground/70",
                      )}
                    >
                      {format(day, "d.M.")}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className={cn("text-sm font-medium tabular-nums", dayHours === 0 && "text-muted-foreground")}>
                      {dayHours > 0 ? formatHours(dayHours) : "–"}
                    </span>
                    {target > 0 && (
                      <span className="text-[11px] text-muted-foreground tabular-nums">{formatHours(target)}</span>
                    )}
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-500",
                        isComplete ? "bg-emerald-500" : "bg-primary/70",
                      )}
                      style={{ width: `${target > 0 ? Math.min((dayHours / target) * 100, 100) : 0}%` }}
                    />
                  </div>

                  {holiday && (
                    <p className="mt-2 truncate text-[11px] font-medium text-primary" title={holiday.name}>
                      {holiday.name}
                    </p>
                  )}

                  {/* Abwesenheiten sichtbar machen: Sie reduzieren das Tagessoll, ohne sie wäre
                      nicht erkennbar, warum hier nichts (oder nur die Hälfte) zu buchen ist. */}
                  {absence && (
                    <p
                      className={cn(
                        "mt-2 flex items-center gap-1 truncate text-[11px] font-medium",
                        ABSENCE_TYPE_STYLES[absence.type],
                        absence.isPending && "opacity-70",
                      )}
                      title={
                        absence.isPending
                          ? `${absence.label} – noch nicht genehmigt`
                          : `${absence.label}${absence.portion === 0.5 ? " (halber Tag)" : ""}`
                      }
                    >
                      <Plane className="h-3 w-3 shrink-0" />
                      {absence.label}
                      {absence.portion === 0.5 && " ½"}
                      {absence.isPending && " (beantragt)"}
                    </p>
                  )}
                </div>

                {/* Einträge */}
                <div className="flex flex-1 flex-col gap-1.5 px-2 pb-2">
                  {isLoading ? (
                    <>
                      <Skeleton className="h-14 w-full rounded-lg" />
                      <Skeleton className="h-14 w-full rounded-lg opacity-60" />
                    </>
                  ) : (
                    dayEntries.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => editable && setDialog({ date: day, entry })}
                        disabled={!editable}
                        className={cn(
                          "group/entry w-full rounded-lg border border-border/50 bg-card px-2.5 py-2 text-left shadow-xs transition-all",
                          editable
                            ? "hover:border-border hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            : "cursor-default opacity-80",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: entry.project_color || "var(--muted-foreground)" }}
                            />
                            <span className="truncate text-xs font-medium">{entry.project_name || "Ohne Projekt"}</span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold tabular-nums">
                            {formatHours(Number(entry.hours))}
                          </span>
                        </div>
                        {entry.start_time && entry.end_time && (
                          <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                            {entry.start_time.slice(0, 5)}–{entry.end_time.slice(0, 5)}
                          </p>
                        )}
                        {entry.description && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                            {entry.description}
                          </p>
                        )}
                      </button>
                    ))
                  )}

                  {!isLoading && editable && (
                    <button
                      type="button"
                      onClick={() => setDialog({ date: day })}
                      className={cn(
                        "flex items-center justify-center gap-1 rounded-lg border border-dashed border-border/70 py-2 text-xs font-medium text-muted-foreground transition-colors",
                        "hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        dayEntries.length === 0 && "flex-1",
                      )}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Erfassen
                    </button>
                  )}

                  {!isLoading && !editable && dayEntries.length === 0 && (
                    <div className="flex flex-1 items-center justify-center">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {dialog && (
        <EntryDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          date={dialog.date}
          entry={dialog.entry}
          projects={data?.projects ?? []}
          dayTarget={targetFor(dialog.date)}
        />
      )}
    </>
  )
}
