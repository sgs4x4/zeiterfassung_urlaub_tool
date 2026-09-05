"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { updateUserEmployment } from "@/app/actions/admin"
import { EMPLOYEE_TYPE_DEFAULTS, type EmployeeType, type User, type Weekday, type WeeklySchedule } from "@/lib/db"
import { formatHours } from "@/lib/utils"

const WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Mo",
  tuesday: "Di",
  wednesday: "Mi",
  thursday: "Do",
  friday: "Fr",
  saturday: "Sa",
  sunday: "So",
}

const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  monday: 8,
  tuesday: 8,
  wednesday: 8,
  thursday: 8,
  friday: 8,
  saturday: 0,
  sunday: 0,
}

export function formatHoursInput(value: number) {
  const hours = Math.floor(value)
  const minutes = Math.round((value - hours) * 60)
  return `${hours}:${String(minutes).padStart(2, "0")}`
}

export function parseHoursInput(value: string) {
  const normalized = value.replace(",", ".").trim()
  if (normalized.includes(":")) {
    const [hoursStr, minutesStr] = normalized.split(":")
    const hours = Number.parseInt(hoursStr, 10)
    const minutes = Number.parseInt(minutesStr, 10)
    if (!Number.isNaN(hours) && !Number.isNaN(minutes) && minutes >= 0 && minutes < 60) {
      return hours + minutes / 60
    }
  }
  const numberValue = Number.parseFloat(normalized)
  return Number.isNaN(numberValue) ? 0 : numberValue
}

/**
 * Beschäftigungsart, Monats-Soll und Wochenplan eines Mitarbeiters. Jede Änderung wird über
 * updateUserEmployment als neuer, zeitlich abgegrenzter Vertragszeitraum gespeichert
 * (user_employment_terms) statt die users-Zeile zu überschreiben – siehe scripts/019.
 */
export function EmploymentDialog({
  user,
  onClose,
  onSaved,
}: {
  user: User | null
  onClose: () => void
  onSaved?: () => void
}) {
  const [employeeType, setEmployeeType] = useState<EmployeeType>("vollzeit")
  const [monthlyHours, setMonthlyHours] = useState("")
  const [scheduleInputs, setScheduleInputs] = useState<Record<Weekday, string>>(
    WEEKDAYS.reduce((acc, day) => ({ ...acc, [day]: formatHoursInput(DEFAULT_WEEKLY_SCHEDULE[day]) }), {} as Record<Weekday, string>),
  )
  // Rückwirkend erlaubt (Korrektur), in die Zukunft nicht – siehe updateUserEmployment.
  const [effectiveFrom, setEffectiveFrom] = useState<Date>(new Date())
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const schedule: WeeklySchedule =
      typeof user.weekly_schedule === "string"
        ? JSON.parse(user.weekly_schedule as unknown as string)
        : user.weekly_schedule || DEFAULT_WEEKLY_SCHEDULE

    setEmployeeType((user.employee_type as EmployeeType) || "vollzeit")
    setMonthlyHours((user.monthly_hours || 173).toString())
    setScheduleInputs(
      WEEKDAYS.reduce((acc, day) => ({ ...acc, [day]: formatHoursInput(schedule[day] ?? 0) }), {} as Record<Weekday, string>),
    )
    setEffectiveFrom(new Date())
    setStatus("idle")
    setMessage(null)
  }, [user])

  const weeklySum = WEEKDAYS.reduce((sum, day) => sum + parseHoursInput(scheduleInputs[day] ?? "0"), 0)

  const handleSave = async () => {
    if (!user) return
    setStatus("saving")
    setMessage(null)

    const parsedSchedule = WEEKDAYS.reduce(
      (acc, day) => ({ ...acc, [day]: parseHoursInput(scheduleInputs[day] ?? "0") }),
      {} as WeeklySchedule,
    )

    try {
      await updateUserEmployment(user.id, {
        employeeType,
        monthlyHours: Number.parseFloat(monthlyHours),
        weeklySchedule: parsedSchedule,
        effectiveFrom: format(effectiveFrom, "yyyy-MM-dd"),
      })
      setScheduleInputs(
        WEEKDAYS.reduce((acc, day) => ({ ...acc, [day]: formatHoursInput(parsedSchedule[day]) }), {} as Record<Weekday, string>),
      )
      setStatus("success")
      setMessage("Sollstunden erfolgreich gespeichert.")
      onSaved?.()
      setTimeout(() => {
        onClose()
        setStatus("idle")
        setMessage(null)
      }, 1200)
    } catch (error) {
      console.error("Fehler beim Aktualisieren:", error)
      setStatus("error")
      setMessage(error instanceof Error ? error.message : "Fehler beim Speichern")
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Beschäftigung & Sollstunden</DialogTitle>
          <DialogDescription>
            Pflege Vertragsart und monatliches Soll für <strong>{user?.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Gültig ab</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(effectiveFrom, "PPP", { locale: de })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={effectiveFrom}
                  onSelect={(d) => d && setEffectiveFrom(d)}
                  locale={de}
                  disabled={(d) => d > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Ab diesem Tag gilt die neue Regelung. Bereits abgeschlossene Monate bleiben unverändert. Ein Datum in
              der Zukunft ist aktuell nicht möglich.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Beschäftigungsart</Label>
            <Select
              value={employeeType}
              onValueChange={(value: EmployeeType) => {
                setEmployeeType(value)
                setMonthlyHours((EMPLOYEE_TYPE_DEFAULTS[value] ?? 173).toString())
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vollzeit">Vollzeit (173h/Monat)</SelectItem>
                <SelectItem value="teilzeit">Teilzeit (individuell)</SelectItem>
                <SelectItem value="minijob">Minijob (max. 43h/Monat bei 603€ / 13,90€)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Monatsstunden-Soll</Label>
            <Input type="number" step="0.5" value={monthlyHours} onChange={(e) => setMonthlyHours(e.target.value)} />
            {employeeType === "minijob" && (
              <p className="text-xs text-muted-foreground">Max. 43h bei 603€-Grenze und 13,90€ Mindestlohn (2026)</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Wochenplan Mo–So</Label>
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {WEEKDAYS.map((weekday) => (
                  <div key={weekday} className="space-y-1.5 rounded-md border border-border/60 bg-background p-2.5">
                    <div className="flex items-center justify-center">
                      <Label className="text-xs font-semibold tracking-wide text-foreground">
                        {WEEKDAY_LABELS[weekday]}
                      </Label>
                    </div>
                    <Input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9:,]*"
                      placeholder="8:00"
                      className="h-8 text-center text-sm font-medium tabular-nums"
                      value={scheduleInputs[weekday] ?? "0:00"}
                      onChange={(e) => setScheduleInputs((prev) => ({ ...prev, [weekday]: e.target.value }))}
                      onBlur={(e) =>
                        setScheduleInputs((prev) => ({ ...prev, [weekday]: formatHoursInput(parseHoursInput(e.target.value)) }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-1 inline-flex items-center rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
              Summe: <span className="ml-1 font-semibold text-foreground">{formatHours(weeklySum)}</span> / Woche
            </p>
            <p className="text-xs text-muted-foreground">
              Der Wochenplan bestimmt das taggenaue Soll: Feiertage und genehmigte Abwesenheiten reduzieren es
              automatisch.
            </p>
            {message && (
              <Alert variant={status === "error" ? "destructive" : "default"} className="mt-2">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
            <Button variant="outline" onClick={onClose}>
              Schließen
            </Button>
            <Button onClick={handleSave} disabled={status === "saving"}>
              {status === "saving" ? "Speichere…" : "Änderung speichern"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
