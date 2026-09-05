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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  CheckCircle, XCircle, Clock, Trash2, Plus,
  ChevronLeft, ChevronRight, CalendarDays, Pencil,
} from "lucide-react"
import {
  requestAbsence,
  updateMyAbsence,
  getMyAbsences,
  deleteAbsence,
  getVacationBalance,
  getBlockedDays,
  type Absence,
  type BlockedDay,
} from "@/app/actions/absences"
import { ABSENCE_TYPE_LABELS, type AbsenceType } from "@/lib/absence-types"
import { getHolidaysForYear } from "@/app/actions/holidays"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { BUNDESLAENDER, type Bundesland, type Holiday } from "@/lib/holidays"

const TYPE_LABELS = ABSENCE_TYPE_LABELS
const TYPE_COLORS: Record<string, string> = {
  vacation: "bg-blue-500",
  sick: "bg-red-400",
  other: "bg-amber-400",
  special_leave: "bg-purple-500",
  unpaid_leave: "bg-slate-400",
  overtime_compensation: "bg-teal-500",
}
const STATUS_CONFIG = {
  pending:  { label: "Ausstehend", badge: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400" },
  approved: { label: "Genehmigt",  badge: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400" },
  rejected: { label: "Abgelehnt",  badge: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400" },
}

function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function NewRequestDialog({
  open,
  onClose,
  onSuccess,
  initialStartDate,
  initialEndDate,
  editingAbsence,
  readOnly = false,
  bundesland,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  initialStartDate?: string
  initialEndDate?: string
  editingAbsence?: Absence | null
  readOnly?: boolean
  bundesland: Bundesland
}) {
  const [type, setType] = useState<AbsenceType>("vacation")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [dayPart, setDayPart] = useState<"full" | "half_am" | "half_pm">("full")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calculatedDays, setCalculatedDays] = useState<number>(0)
  const [isCalculatingDays, setIsCalculatingDays] = useState(false)

  const reset = () => {
    setType("vacation")
    setStartDate("")
    setEndDate("")
    setDayPart("full")
    setReason("")
    setError(null)
  }

  useEffect(() => {
    if (!open) return
    if (editingAbsence) {
      setType(editingAbsence.type)
      setStartDate(editingAbsence.start_date)
      setEndDate(editingAbsence.end_date)
      setDayPart(editingAbsence.day_part || "full")
      setReason(editingAbsence.reason || "")
      return
    }

    setType("vacation")
    setStartDate(initialStartDate || "")
    setEndDate(initialEndDate || initialStartDate || "")
    setDayPart("full")
    setReason("")
  }, [open, initialStartDate, initialEndDate, editingAbsence])

  useEffect(() => {
    const calculateDays = async () => {
      if (!open || type !== "vacation" || !startDate || !endDate) {
        setCalculatedDays(0)
        return
      }

      setIsCalculatingDays(true)
      try {
        const start = parseLocalDate(startDate)
        const end = parseLocalDate(endDate)
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
          setCalculatedDays(0)
          return
        }

        const years: number[] = []
        for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
          years.push(year)
        }
        const holidays = (await Promise.all(years.map((year) => getHolidaysForYear(year, bundesland)))).flat()
        const holidayDates = new Set(holidays.map((h) => h.date))
        const vacationDays = eachDayOfInterval({ start, end }).filter((day) => {
          if (isWeekend(day)) return false
          return !holidayDates.has(format(day, "yyyy-MM-dd"))
        }).length

        setCalculatedDays(dayPart === "full" ? vacationDays : 0.5)
      } catch {
        setCalculatedDays(0)
      } finally {
        setIsCalculatingDays(false)
      }
    }

    calculateDays()
  }, [open, type, startDate, endDate, dayPart, bundesland])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (readOnly) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set("type", type)
      fd.set("start_date", startDate)
      fd.set("end_date", endDate)
      fd.set("day_part", dayPart)
      fd.set("reason", reason)
      if (editingAbsence) {
        await updateMyAbsence(editingAbsence.id, fd)
      } else {
        await requestAbsence(fd)
      }
      reset()
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Senden")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingAbsence ? "Abwesenheit bearbeiten" : "Abwesenheit beantragen"}</DialogTitle>
          <DialogDescription>
            {editingAbsence
              ? readOnly
                ? "Nur Ansicht. Dieser Eintrag ist nicht mehr bearbeitbar."
                : "Passe deinen bestehenden Antrag an."
              : "Dein Antrag wird zur Genehmigung weitergeleitet."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Art der Abwesenheit</Label>
            <Select value={type} onValueChange={(v) => setType(v as AbsenceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ABSENCE_TYPE_LABELS) as AbsenceType[]).map((key) => (
                  <SelectItem key={key} value={key}>{ABSENCE_TYPE_LABELS[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Von</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Bis</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required min={startDate} />
            </div>
          </div>
          {type === "vacation" && (
            <div className="space-y-1.5">
              <Label>Tagesumfang</Label>
              <Select value={dayPart} onValueChange={(v) => setDayPart(v as "full" | "half_am" | "half_pm") }>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Ganztag</SelectItem>
                  <SelectItem value="half_am">Halbtag (Vormittag)</SelectItem>
                  <SelectItem value="half_pm">Halbtag (Nachmittag)</SelectItem>
                </SelectContent>
              </Select>
              {dayPart !== "full" && (
                <p className="text-xs text-muted-foreground">Halbtage sind nur für einzelne Tage möglich.</p>
              )}
              <p className="text-xs text-muted-foreground">
                {isCalculatingDays
                  ? "Berechne Urlaubstage..."
                  : `Verbrauchte Urlaubstage: ${calculatedDays}`}
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Begründung <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea placeholder="z.B. Familienurlaub..." value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
          {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{error}</p>}
          <div className="flex gap-2 pt-1">
            {!readOnly && (
              <Button
                type="submit"
                disabled={loading || (type === "vacation" && (isCalculatingDays || calculatedDays <= 0))}
                className="flex-1"
              >
                {loading ? "Wird gespeichert..." : editingAbsence ? "Änderungen speichern" : "Antrag einreichen"}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Mini personal calendar
function MyCalendar({
  absences,
  bundesland,
  onRequestRange,
  onOpenAbsence,
}: {
  absences: Absence[]
  bundesland: Bundesland
  onRequestRange: (start: Date, end: Date) => void
  onOpenAbsence: (absence: Absence) => void
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isDragging, setIsDragging] = useState(false)
  const [rangeStart, setRangeStart] = useState<Date | null>(null)
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null)
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())
  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const firstDow = (startOfMonth(currentMonth).getDay() + 6) % 7
  const padding = Array.from({ length: firstDow })

  useEffect(() => {
    const loadMonthData = async () => {
      try {
        const [blockedData, holidayData] = await Promise.all([
          getBlockedDays(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
          getHolidaysForYear(currentMonth.getFullYear(), bundesland),
        ])
        setBlockedDays(blockedData)
        setHolidays(holidayData)
      } catch {
        setBlockedDays([])
        setHolidays([])
      }
    }
    loadMonthData()
  }, [currentMonth, bundesland])

  const isBlocked = (day: Date) => blockedDays.some((b) => b.date === format(day, "yyyy-MM-dd"))
  const getHolidayForDay = (day: Date) => holidays.find((h) => h.date === format(day, "yyyy-MM-dd"))

  const normalizeRange = (start: Date, end: Date) =>
    start <= end ? { start, end } : { start: end, end: start }

  const inSelectedRange = (day: Date) => {
    if (!rangeStart) return false
    const end = rangeEnd || rangeStart
    const range = normalizeRange(rangeStart, end)
    return isWithinInterval(day, { start: range.start, end: range.end })
  }

  const finalizeSelection = (selectionEnd: Date) => {
    if (!rangeStart) return
    const range = normalizeRange(rangeStart, selectionEnd)
    const blockedInRange = eachDayOfInterval({ start: range.start, end: range.end }).some((day) => isBlocked(day))
    if (blockedInRange) {
      alert("Der gewählte Zeitraum enthält gesperrte Tage. Bitte Teamkalender prüfen.")
      setRangeStart(null)
      setRangeEnd(null)
      setIsDragging(false)
      return
    }
    setRangeStart(range.start)
    setRangeEnd(range.end)
    setIsDragging(false)
    onRequestRange(range.start, range.end)
    setRangeStart(null)
    setRangeEnd(null)
  }

  function getForDay(day: Date) {
    return absences.filter((a) => {
      if (a.status === "rejected") return false
      try {
        return isWithinInterval(day, {
          start: parseLocalDate(a.start_date),
          end: parseLocalDate(a.end_date),
        })
      }
      catch { return false }
    })
  }

  const selectedDayAbsences = selectedDay ? getForDay(selectedDay) : []
  const selectedHoliday = selectedDay ? getHolidayForDay(selectedDay) : null
  const selectedDayBlocked = selectedDay ? isBlocked(selectedDay) : false

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-base font-semibold">{format(currentMonth, "MMMM yyyy", { locale: de })}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 text-center">
        {["Mo","Di","Mi","Do","Fr","Sa","So"].map((d) => (
          <div key={d} className="text-xs font-semibold text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
        {padding.map((_, i) => <div key={`p-${i}`} className="bg-background min-h-[108px]" />)}
        {days.map((day) => {
          const dayAbsences = getForDay(day)
          const holiday = getHolidayForDay(day)
          const today = isToday(day)
          const weekend = isWeekend(day)
          const selected = inSelectedRange(day)
          const blocked = isBlocked(day)
          const isDaySelected = selectedDay && day.toDateString() === selectedDay.toDateString()

          return (
            <div
              key={day.toISOString()}
              onMouseDown={() => {
                if (blocked) return
                setIsDragging(true)
                setRangeStart(day)
                setRangeEnd(day)
              }}
              onMouseEnter={() => {
                if (isDragging && rangeStart) {
                  setRangeEnd(day)
                }
              }}
              onMouseUp={() => {
                if (blocked) {
                  setIsDragging(false)
                  return
                }
                finalizeSelection(day)
              }}
              onClick={() => setSelectedDay(day)}
              className={cn(
                "bg-background min-h-[108px] p-1.5 select-none cursor-pointer relative transition-colors hover:bg-accent/40",
                weekend && "bg-muted/20",
                selected && "ring-1 ring-primary/70 bg-primary/10",
                isDaySelected && "ring-2 ring-inset ring-primary/70",
                blocked && "bg-destructive/10 hover:bg-destructive/15",
                holiday && "bg-primary/10",
              )}
            >
              <div className="flex items-start justify-between">
                <span className={cn(
                "relative z-10 text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full shrink-0",
                today && "bg-primary text-primary-foreground",
                !today && weekend && "text-muted-foreground",
              )}>
                {format(day, "d")}
                </span>
                {holiday && (
                  <span
                    className="text-[10px] font-medium text-primary truncate max-w-[78px]"
                    title={holiday.name}
                  >
                    {holiday.name}
                  </span>
                )}
              </div>

              <div className="mt-1 space-y-1">
                {dayAbsences.slice(0, 2).map((absence) => (
                  <button
                    key={absence.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenAbsence(absence)
                    }}
                    className={cn(
                      "w-full text-left text-[10px] px-1.5 py-0.5 rounded-sm text-white font-medium truncate border",
                      TYPE_COLORS[absence.type],
                      absence.status === "pending" ? "border-white/80" : "border-transparent"
                    )}
                    title={`${TYPE_LABELS[absence.type]} (${absence.status === "pending" ? "Beantragt" : "Genehmigt"})`}
                  >
                    {absence.status === "pending" ? "⏳ " : ""}
                    {TYPE_LABELS[absence.type]}
                  </button>
                ))}
                {dayAbsences.length > 2 && (
                  <div className="text-[10px] text-muted-foreground px-1 font-medium">
                    +{dayAbsences.length - 2} weitere
                  </div>
                )}
              </div>

              {blocked && (
                <div className="absolute top-0.5 right-0.5 text-[9px] font-bold text-destructive">×</div>
              )}
            </div>
          )
        })}
      </div>

      {selectedDay && (
        <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
          <p className="text-sm font-semibold">{format(selectedDay, "EEEE, dd. MMMM yyyy", { locale: de })}</p>
          {selectedHoliday && (
            <p className="text-xs text-primary mt-1">{selectedHoliday.name}</p>
          )}
          {selectedDayBlocked && (
            <p className="text-xs text-destructive mt-1">Dieser Tag ist gesperrt.</p>
          )}
          {selectedDayAbsences.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-2">Keine Abwesenheiten an diesem Tag.</p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {selectedDayAbsences.map((absence) => (
                <button
                  key={absence.id}
                  type="button"
                  onClick={() => onOpenAbsence(absence)}
                  className="w-full rounded-md border border-border/70 bg-background px-2.5 py-2 text-left text-xs hover:bg-accent/40"
                >
                  <p className="font-semibold">{TYPE_LABELS[absence.type]} · {absence.status === "pending" ? "Beantragt" : absence.status === "approved" ? "Genehmigt" : "Abgelehnt"}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {absence.start_date} – {absence.end_date} · {absence.days} Tage
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">Tipp: Ziehen über mehrere Tage öffnet den Antrag mit vorausgefülltem Zeitraum.</p>
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-blue-500/30 border border-blue-500/50" /><span className="text-[10px] text-muted-foreground">Urlaub</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-400/30 border border-red-400/50" /><span className="text-[10px] text-muted-foreground">Krank</span></div>
        <div className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-amber-400" /><span className="text-[10px] text-muted-foreground">Ausstehend</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-primary/20 border border-primary/60" /><span className="text-[10px] text-muted-foreground">Feiertag ({BUNDESLAENDER[bundesland]})</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-destructive/20 border border-destructive/60" /><span className="text-[10px] text-muted-foreground">Gesperrter Tag</span></div>
      </div>
    </div>
  )
}

export function VacationDashboard({ isAdmin, bundesland = "BY" }: { isAdmin: boolean; bundesland?: Bundesland }) {
  const [myAbsences, setMyAbsences] = useState<Absence[]>([])
  const [balance, setBalance] = useState({ total: 30, used: 0, pending: 0, available: 30 })
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [prefillStartDate, setPrefillStartDate] = useState("")
  const [prefillEndDate, setPrefillEndDate] = useState("")
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null)
  const [isReadOnlyView, setIsReadOnlyView] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mine, bal] = await Promise.all([getMyAbsences(), getVacationBalance()])
      setMyAbsences(mine)
      setBalance(bal)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm("Antrag wirklich löschen?")) return
    await deleteAbsence(id)
    load()
  }

  const usedPct    = balance.total > 0 ? Math.round((balance.used    / balance.total) * 100) : 0
  const pendingPct = balance.total > 0 ? Math.round((balance.pending / balance.total) * 100) : 0

  const handleCalendarRequest = (start: Date, end: Date) => {
    setEditingAbsence(null)
    setIsReadOnlyView(false)
    setPrefillStartDate(format(start, "yyyy-MM-dd"))
    setPrefillEndDate(format(end, "yyyy-MM-dd"))
    setShowNew(true)
  }

  const handleOpenAbsence = (absence: Absence) => {
    const todayStr = format(new Date(), "yyyy-MM-dd")
    const canEdit = absence.status === "pending" || (absence.type === "vacation" && absence.start_date > todayStr)

    setEditingAbsence(absence)
    setIsReadOnlyView(!canEdit)
    setPrefillStartDate(absence.start_date)
    setPrefillEndDate(absence.end_date)
    setShowNew(true)
  }

  return (
    <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6 md:py-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meine Urlaubsplanung</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Beantrage Urlaub und sieh deine Abwesenheiten im Überblick</p>
        </div>
        <Button
          onClick={() => {
            setEditingAbsence(null)
            setIsReadOnlyView(false)
            setPrefillStartDate("")
            setPrefillEndDate("")
            setShowNew(true)
          }}
          className="shadow-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Abwesenheit beantragen
        </Button>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Gesamt",    value: balance.total,     color: "text-foreground" },
          { label: "Genommen",  value: balance.used,      color: "text-foreground" },
          { label: "Beantragt", value: balance.pending,   color: "text-amber-600 dark:text-amber-400" },
          { label: "Verfügbar", value: balance.available, color: "text-emerald-600 dark:text-emerald-400" },
        ].map((item) => (
          <Card key={item.label} className="border-border/70 bg-card/90">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{item.label}</p>
              <p className={cn("text-3xl font-bold mt-1 leading-none", item.color)}>{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">Urlaubstage</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress bar */}
      <Card className="border-border/70 bg-card/90">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Urlaubskontingent {new Date().getFullYear()}</span>
            <span>{balance.used + balance.pending} / {balance.total} Tage verplant</span>
          </div>
          <Progress value={Math.min(usedPct + pendingPct, 100)} className="h-3" />
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-xs text-muted-foreground">Genehmigt ({balance.used})</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="text-xs text-muted-foreground">Ausstehend ({balance.pending})</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" /><span className="text-xs text-muted-foreground">Verfügbar ({balance.available})</span></div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Mein Kalender</h2>
          <Card className="border-border/70 bg-card/90">
            <CardContent className="pt-5 pb-4">
              <MyCalendar
                absences={myAbsences}
                bundesland={bundesland}
                onRequestRange={handleCalendarRequest}
                onOpenAbsence={handleOpenAbsence}
              />
            </CardContent>
          </Card>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Meine Abwesenheiten</h2>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Lade...</div>
          ) : myAbsences.length === 0 ? (
            <Card className="border-border/70 bg-card/90">
              <CardContent className="py-16 text-center">
                <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="font-medium text-muted-foreground">Noch keine Abwesenheiten</p>
                <p className="text-sm text-muted-foreground mt-1">Erstelle deinen ersten Urlaubsantrag.</p>
                <Button className="mt-4 shadow-sm" onClick={() => {
                  setEditingAbsence(null)
                  setIsReadOnlyView(false)
                  setShowNew(true)
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Jetzt beantragen
                </Button>
              </CardContent>
            </Card>
          ) : (
            myAbsences.map((absence) => {
              const statusCfg = STATUS_CONFIG[absence.status] || STATUS_CONFIG.pending
              const todayStr = format(new Date(), "yyyy-MM-dd")
              const canEdit = absence.status === "pending" || (absence.type === "vacation" && absence.start_date > todayStr)
              const canDelete = absence.type === "vacation" ? absence.start_date > todayStr : absence.status === "pending"
              return (
                <Card key={absence.id} className="overflow-hidden border-border/70 bg-card/90">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-4 p-4">
                      <div className={cn("w-1 self-stretch rounded-full shrink-0 min-h-[48px]", TYPE_COLORS[absence.type])} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{TYPE_LABELS[absence.type]}</span>
                          <Badge variant="outline" className={cn("text-xs border", statusCfg.badge)}>
                            {absence.status === "approved" && <CheckCircle className="h-3 w-3 mr-1" />}
                            {absence.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                            {absence.status === "pending"  && <Clock className="h-3 w-3 mr-1" />}
                            {statusCfg.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {format(new Date(absence.start_date), "dd. MMMM yyyy", { locale: de })}
                          {" – "}
                          {format(new Date(absence.end_date), "dd. MMMM yyyy", { locale: de })}
                          <span className="ml-2 font-medium text-foreground">{absence.days} Arbeitstage</span>
                        </p>
                        {absence.day_part && absence.day_part !== "full" && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {absence.day_part === "half_am" ? "Halbtag (Vormittag)" : "Halbtag (Nachmittag)"}
                          </p>
                        )}
                        {absence.reason && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">&ldquo;{absence.reason}&rdquo;</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => handleOpenAbsence(absence)}
                          title={canEdit ? "Bearbeiten" : "Ansehen"}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(absence.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </section>
      </div>

      <NewRequestDialog
        open={showNew}
        onClose={() => {
          setShowNew(false)
          setEditingAbsence(null)
          setIsReadOnlyView(false)
        }}
        onSuccess={load}
        initialStartDate={prefillStartDate}
        initialEndDate={prefillEndDate}
        editingAbsence={editingAbsence}
        readOnly={isReadOnlyView}
        bundesland={bundesland}
      />
    </main>
  )
}
