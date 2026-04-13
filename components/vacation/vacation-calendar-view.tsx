"use client"

import { useEffect, useState, useCallback } from "react"
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, isWeekend, addMonths, subMonths, isWithinInterval,
} from "date-fns"
import { de } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronLeft, ChevronRight, Lock } from "lucide-react"
import {
  getAbsencesForCalendarView,
  getMyAbsences,
  getBlockedDays,
  getAllBlockedDays,
  updateAbsenceStatus,
  blockDay,
  blockDayForCategories,
  unblockDay,
  unblockDayForCategories,
  type Absence,
  type BlockedDay,
} from "@/app/actions/absences"
import { USER_CATEGORY_LABELS, type UserCategory } from "@/lib/db"
import { cn } from "@/lib/utils"

const TYPE_LABELS: Record<string, string> = { vacation: "Urlaub", sick: "Krankheit", other: "Sonstiges" }
const TYPE_COLORS: Record<string, string> = { vacation: "bg-blue-500", sick: "bg-red-400", other: "bg-amber-400" }
const TYPE_TEXT: Record<string, string>   = { vacation: "text-blue-600 dark:text-blue-400", sick: "text-red-600 dark:text-red-400", other: "text-amber-600 dark:text-amber-400" }
const STATUS_LABELS: Record<string, string> = { approved: "Genehmigt", pending: "Beantragt" }
type StatusFilter = "all" | "approved" | "pending"

function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function getEmployeeColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 62% 46%)`
}

interface VacationCalendarViewProps {
  isAdmin: boolean
  showAllAbsences?: boolean
}

export function VacationCalendarView({ isAdmin, showAllAbsences = false }: VacationCalendarViewProps) {
  const [absences, setAbsences] = useState<Absence[]>([])
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [selectedAbsenceId, setSelectedAbsenceId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [blockReason, setBlockReason] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<UserCategory[]>([])
  const [isSavingBlock, setIsSavingBlock] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [absenceData, blockedData] = await Promise.all([
        isAdmin || showAllAbsences ? getAbsencesForCalendarView() : getMyAbsences(),
        isAdmin ? getAllBlockedDays(currentMonth.getFullYear(), currentMonth.getMonth() + 1) : getBlockedDays(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
      ])
      setAbsences(absenceData)
      setBlockedDays(blockedData)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, showAllAbsences, currentMonth])

  useEffect(() => { load() }, [load])

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const firstDow = (startOfMonth(currentMonth).getDay() + 6) % 7
  const paddingDays = Array.from({ length: firstDow })

  function getAbsencesForDay(day: Date): Absence[] {
    return absences.filter((a) => {
      if (a.status !== "approved" && a.status !== "pending") return false
      if (statusFilter !== "all" && a.status !== statusFilter) return false
      try {
        return isWithinInterval(day, { start: parseLocalDate(a.start_date), end: parseLocalDate(a.end_date) })
      } catch { return false }
    })
  }

  // Helper: Check position of a day within a multi-day absence
  function getAbsencePositionInRange(absence: Absence, day: Date): "start" | "middle" | "end" | "single" | null {
    try {
      const absStart = parseLocalDate(absence.start_date)
      const absEnd = parseLocalDate(absence.end_date)
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate())

      if (dayStart < absStart || dayStart > absEnd) return null
      if (absStart.getTime() === absEnd.getTime() && dayStart.getTime() === absStart.getTime()) return "single"
      if (dayStart.getTime() === absStart.getTime()) return "start"
      if (dayStart.getTime() === absEnd.getTime()) return "end"
      return "middle"
    } catch { return null }
  }

  // Helper: Get days count for absence
  function getAbsenceDayCount(absence: Absence): number {
    try {
      const start = parseLocalDate(absence.start_date)
      const end = parseLocalDate(absence.end_date)
      return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    } catch { return 1 }
  }

  const selectedAbsences = selectedDay ? getAbsencesForDay(selectedDay) : []
  const selectedAbsence = selectedAbsenceId
    ? selectedAbsences.find((a) => a.id === selectedAbsenceId) || null
    : selectedAbsences[0] || null
  const selectedDateStr = selectedDay ? format(selectedDay, "yyyy-MM-dd") : ""
  const selectedBlockedDay = selectedDateStr ? blockedDays.find((d) => d.date === selectedDateStr) : null

  useEffect(() => {
    setBlockReason(selectedBlockedDay?.reason || "")
    setSelectedCategories([])
  }, [selectedBlockedDay?.id])

  useEffect(() => {
    setSelectedAbsenceId(null)
  }, [selectedDay?.toDateString()])

  const handleToggleBlockedDay = async () => {
    if (!selectedDay) return
    const dateStr = format(selectedDay, "yyyy-MM-dd")
    setIsSavingBlock(true)
    try {
      if (selectedBlockedDay) {
        // Unblock the day
        if (selectedBlockedDay.category) {
          // Category-specific unblocking
          const categories = selectedBlockedDay.category.split(",") as UserCategory[]
          await unblockDayForCategories(dateStr, categories)
        } else {
          // Global unblocking
          await unblockDay(dateStr)
        }
      } else {
        // Block the day
        if (selectedCategories.length > 0) {
          // Category-specific blocking
          await blockDayForCategories(dateStr, blockReason || null, selectedCategories)
        } else {
          // Global blocking (legacy)
          await blockDay(dateStr, blockReason || null)
        }
      }
      await load()
      setSelectedCategories([])
    } catch (error) {
      alert(error instanceof Error ? error.message : "Fehler beim Speichern")
    } finally {
      setIsSavingBlock(false)
    }
  }

  const handleStatusUpdate = async (absenceId: string, status: "approved" | "rejected") => {
    setIsUpdatingStatus(true)
    try {
      await updateAbsenceStatus(absenceId, status)
      await load()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Fehler beim Aktualisieren")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // Collect all people with absences this month
  const monthPeople = (isAdmin || showAllAbsences)
    ? [...new Set(
        absences
          .filter((a) => a.status === "approved" || a.status === "pending")
          .filter((a) => (statusFilter === "all" ? true : a.status === statusFilter))
          .filter((a) => {
            try {
              const start = startOfMonth(currentMonth)
              const end   = endOfMonth(currentMonth)
              return parseLocalDate(a.start_date) <= end && parseLocalDate(a.end_date) >= start
            } catch { return false }
          })
          .map((a) => a.user?.name).filter(Boolean)
      )]
    : []

  return (
    <main className="container mx-auto p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isAdmin ? "Teamkalender" : showAllAbsences ? "Abwesenheitsübersicht" : "Mein Abwesenheitskalender"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isAdmin ? "Abwesenheiten aller Mitarbeiter inkl. beantragter Tage" : showAllAbsences ? "Abwesenheiten aller Mitarbeiter und gesperrte Tage" : "Deine genehmigten und beantragten Abwesenheiten"}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>
          Alle
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "approved" ? "default" : "outline"}
          onClick={() => setStatusFilter("approved")}
        >
          Genehmigt
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "pending" ? "default" : "outline"}
          onClick={() => setStatusFilter("pending")}
        >
          Beantragt
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Calendar */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg font-semibold">
                {format(currentMonth, "MMMM yyyy", { locale: de })}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-2">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
              {paddingDays.map((_, i) => (
                <div key={`pad-${i}`} className="bg-background min-h-[80px]" />
              ))}
              {days.map((day) => {
                const dayAbsences = getAbsencesForDay(day)
                const isBlockedDay = blockedDays.some((b) => b.date === format(day, "yyyy-MM-dd"))
                const weekend = isWeekend(day)
                const today   = isToday(day)
                const selected = selectedDay && day.toDateString() === selectedDay.toDateString()

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "bg-background min-h-[80px] p-1.5 cursor-pointer transition-colors hover:bg-accent/30",
                      weekend && "bg-muted/20",
                      isBlockedDay && "bg-destructive/10",
                      today   && "ring-2 ring-inset ring-primary",
                      selected && "bg-primary/5",
                    )}
                    onClick={() => setSelectedDay(selected ? null : day)}
                  >
                    <div className={cn(
                      "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mx-auto",
                      today   && "bg-primary text-primary-foreground",
                      !today && weekend && "text-muted-foreground",
                      !today && !weekend && "text-foreground"
                    )}>
                      {format(day, "d")}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {isBlockedDay && (
                        <div className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive font-semibold truncate leading-tight">
                          <Lock className="mr-1 inline h-3 w-3" />
                          Gesperrt
                        </div>
                      )}
                      {dayAbsences.slice(0, isAdmin ? 3 : 2).map((a, i) => {
                        const position = getAbsencePositionInRange(a, day)
                        const dayCount = getAbsenceDayCount(a)
                        const isStartDay = position === "start" || position === "single"
                        
                        const employeeSeed = a.user?.email || a.user?.name || a.user_id || a.id
                        const employeeColor = getEmployeeColor(employeeSeed)
                        const displayName = a.user?.name || TYPE_LABELS[a.type]

                        return (
                          <div
                            key={a.id + i}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 text-white font-medium truncate leading-tight border border-transparent transition-all",
                              a.status === "pending" ? "border-white/80 opacity-85" : "border-transparent",
                              {
                                "rounded": position === "single",
                                "rounded-l-md rounded-r-none -mr-2": position === "start",
                                "rounded-r-md rounded-l-none -ml-2": position === "end",
                                "rounded-none -mx-2": position === "middle",
                              }
                            )}
                            style={{ backgroundColor: employeeColor }}
                            title={isAdmin ? `${a.user?.name} – ${TYPE_LABELS[a.type]} (${dayCount}d, ${STATUS_LABELS[a.status] || a.status})` : `${TYPE_LABELS[a.type]} (${dayCount}d, ${STATUS_LABELS[a.status] || a.status})`}
                          >
                            {isStartDay ? (
                              <>
                                {a.status === "pending" ? "⏳ " : ""}
                                <span className="font-semibold">{displayName}</span>
                              </>
                            ) : (
                              <span className="opacity-0">•</span>
                            )}
                          </div>
                        )
                      })}
                      {dayAbsences.length > (isAdmin ? 3 : 2) && (
                        <div className="text-[10px] text-muted-foreground px-1 font-medium">
                          +{dayAbsences.length - (isAdmin ? 3 : 2)} weitere
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 flex-wrap mt-4 pt-4 border-t">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-primary/80" />
                <span className="text-xs text-muted-foreground">Farbe = Mitarbeiter</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-foreground/70" />
                <span className="text-xs text-muted-foreground">Genehmigt</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-foreground/40 border border-foreground/80" />
                <span className="text-xs text-muted-foreground">Beantragt</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-muted" />
                <span className="text-xs text-muted-foreground">Wochenende</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-destructive/30 border border-destructive/70" />
                <span className="text-xs text-muted-foreground">Gesperrter Tag (kein Urlaub möglich)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Selected day detail */}
          {selectedDay && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  {format(selectedDay, "EEEE, dd. MMMM", { locale: de })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedAbsences.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Abwesenheiten</p>
                ) : (
                  <div className="space-y-2">
                    {selectedAbsences.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedAbsenceId(a.id)}
                        className={cn(
                          "w-full text-left rounded-md border p-2 transition-colors hover:bg-accent/40",
                          selectedAbsence?.id === a.id ? "border-primary/40 bg-primary/5" : "border-border/60"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", TYPE_COLORS[a.type])} />
                          <div>
                          {(isAdmin || showAllAbsences) && <p className="text-sm font-medium">{a.user?.name}</p>}
                          <p className="text-sm text-muted-foreground">{TYPE_LABELS[a.type]}</p>
                          <Badge
                            variant="outline"
                            className="text-[10px] mt-0.5 py-0"
                          >
                            {a.status === "approved" ? "Genehmigt" : a.status === "pending" ? "Beantragt" : "Abgelehnt"}
                          </Badge>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {format(parseLocalDate(a.start_date), "dd.MM.")} – {format(parseLocalDate(a.end_date), "dd.MM.yyyy")}
                            {" · "}{a.days} Tage
                          </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedAbsence && (
                  <div className="mt-3 rounded-md border border-border/70 bg-muted/20 p-2.5 text-xs">
                    <p className="font-semibold text-foreground">Details</p>
                    {(isAdmin || showAllAbsences) && <p className="mt-1 text-muted-foreground">Mitarbeiter: {selectedAbsence.user?.name || "-"}</p>}
                    <p className="mt-0.5 text-muted-foreground">Typ: {TYPE_LABELS[selectedAbsence.type]}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      Zeitraum: {format(parseLocalDate(selectedAbsence.start_date), "dd.MM.yyyy")} – {format(parseLocalDate(selectedAbsence.end_date), "dd.MM.yyyy")}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">Dauer: {selectedAbsence.days} Tage</p>
                    {selectedAbsence.reason && (
                      <p className="mt-0.5 text-muted-foreground">Grund: {selectedAbsence.reason}</p>
                    )}

                    {isAdmin && selectedAbsence.status === "pending" && (
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 px-2"
                          disabled={isUpdatingStatus}
                          onClick={() => handleStatusUpdate(selectedAbsence.id, "approved")}
                        >
                          Genehmigen
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          disabled={isUpdatingStatus}
                          onClick={() => handleStatusUpdate(selectedAbsence.id, "rejected")}
                        >
                          Ablehnen
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {selectedBlockedDay && (
                  <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                    <p className="font-semibold">Tag ist gesperrt</p>
                    <p className="mt-0.5">{selectedBlockedDay.reason || "Keine zusätzliche Begründung"}</p>
                  </div>
                )}

                {isAdmin && selectedDay && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    <p className="text-xs text-muted-foreground">Admin-Steuerung für Sperrtage</p>
                    <Input
                      placeholder="Grund für Sperrung (optional)"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                    />
                    
                    {!selectedBlockedDay && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground">Für welches Team:</p>
                        <div className="space-y-1.5">
                          {(Object.entries(USER_CATEGORY_LABELS) as [UserCategory, string][]).map(([cat, label]) => (
                            <div key={cat} className="flex items-center gap-2">
                              <Checkbox
                                id={`cat-${cat}`}
                                checked={selectedCategories.includes(cat)}
                                onCheckedChange={(checked) => {
                                  setSelectedCategories(prev =>
                                    checked
                                      ? [...prev, cat]
                                      : prev.filter(c => c !== cat)
                                  )
                                }}
                              />
                              <label htmlFor={`cat-${cat}`} className="text-xs cursor-pointer hover:text-foreground/80">
                                {label}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {selectedBlockedDay && selectedBlockedDay.category && (
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium">Gesperrt für:</p>
                        <p className="mt-0.5">
                          {selectedBlockedDay.category.split(",").map(cat => 
                            USER_CATEGORY_LABELS[cat as UserCategory] || cat
                          ).join(", ")}
                        </p>
                      </div>
                    )}
                    
                    <Button size="sm" className="w-full" variant={selectedBlockedDay ? "outline" : "default"} onClick={handleToggleBlockedDay} disabled={isSavingBlock || (!selectedBlockedDay && selectedCategories.length === 0)}>
                      {isSavingBlock ? "Speichert..." : selectedBlockedDay ? "Sperrung entfernen" : "Tag sperren"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* This month summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {format(currentMonth, "MMMM", { locale: de })} – Übersicht
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isAdmin ? (
                monthPeople.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Abwesenheiten diesen Monat</p>
                ) : (
                  monthPeople.map((name) => (
                    <div key={name} className="flex items-center gap-2 text-sm">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {(name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span>{name}</span>
                    </div>
                  ))
                )
              ) : (
                absences.filter((a) => {
                  if (a.status !== "approved" && a.status !== "pending") return false
                  if (statusFilter !== "all" && a.status !== statusFilter) return false
                  try {
                    return parseLocalDate(a.start_date) <= endOfMonth(currentMonth) &&
                           parseLocalDate(a.end_date)   >= startOfMonth(currentMonth)
                  } catch { return false }
                }).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Abwesenheiten diesen Monat</p>
                ) : (
                  absences
                    .filter((a) => {
                      if (a.status !== "approved" && a.status !== "pending") return false
                      if (statusFilter !== "all" && a.status !== statusFilter) return false
                      try {
                        return parseLocalDate(a.start_date) <= endOfMonth(currentMonth) &&
                               parseLocalDate(a.end_date)   >= startOfMonth(currentMonth)
                      } catch { return false }
                    })
                    .map((a) => (
                      <div key={a.id} className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className={cn("w-2 h-2 rounded-full", TYPE_COLORS[a.type])} />
                          <span className={cn("text-sm font-medium", TYPE_TEXT[a.type])}>{TYPE_LABELS[a.type]}</span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-3.5">
                          {format(new Date(a.start_date), "dd.MM.")} – {format(new Date(a.end_date), "dd.MM.yyyy")}
                          {" · "}{a.days} Tage
                        </p>
                      </div>
                    ))
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
