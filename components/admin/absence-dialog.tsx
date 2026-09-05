"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createAbsenceForUser } from "@/app/actions/absences"
import { ABSENCE_TYPE_LABELS, HALF_DAY_ABSENCE_TYPES, type AbsenceType } from "@/lib/absence-types"
import type { User } from "@/lib/db"

const TYPE_HINTS: Partial<Record<AbsenceType, string>> = {
  vacation: "Wird vom Urlaubskontingent abgezogen.",
  special_leave: "Bezahlt und zusätzlich – belastet das Urlaubskontingent nicht.",
  unpaid_leave: "Ohne Bezahlung, reduziert nur das Soll.",
  overtime_compensation: "Bucht die planmäßigen Stunden vom Überstundenkonto ab.",
  sick: "Reduziert das Soll, ohne Kontingent zu belasten.",
  other: "Reduziert das Soll, ohne Kontingent zu belasten.",
}

/**
 * Abwesenheit stellvertretend für einen Mitarbeitenden eintragen (telefonische Krankmeldung,
 * gewährter Sonderurlaub …). Sie ist sofort genehmigt – eingetragen wird sie ja von der
 * genehmigenden Stelle.
 */
export function AbsenceDialog({
  user,
  onClose,
  onSaved,
}: {
  user: User | null
  onClose: () => void
  onSaved?: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [type, setType] = useState<AbsenceType>("sick")
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [dayPart, setDayPart] = useState<"full" | "half_am" | "half_pm">("full")
  const [reason, setReason] = useState("")
  const [specialLeaveReason, setSpecialLeaveReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const now = new Date().toISOString().slice(0, 10)
    setType("sick")
    setStartDate(now)
    setEndDate(now)
    setDayPart("full")
    setReason("")
    setSpecialLeaveReason("")
    setError(null)
  }, [user])

  const supportsHalfDay = HALF_DAY_ABSENCE_TYPES.includes(type)

  const handleSave = async () => {
    if (!user) return
    setIsSaving(true)
    setError(null)
    try {
      await createAbsenceForUser({
        userId: user.id,
        type,
        startDate,
        endDate,
        dayPart: supportsHalfDay ? dayPart : "full",
        reason: reason.trim() || null,
        specialLeaveReason: specialLeaveReason.trim() || null,
      })
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Abwesenheit eintragen</DialogTitle>
          <DialogDescription>
            Trage eine Abwesenheit für <strong>{user?.name}</strong> ein. Sie gilt sofort als genehmigt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Art</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as AbsenceType)
                if (!HALF_DAY_ABSENCE_TYPES.includes(v as AbsenceType)) setDayPart("full")
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ABSENCE_TYPE_LABELS) as AbsenceType[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {ABSENCE_TYPE_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {TYPE_HINTS[type] && <p className="text-xs text-muted-foreground">{TYPE_HINTS[type]}</p>}
          </div>

          {type === "special_leave" && (
            <div className="space-y-2">
              <Label>Anlass</Label>
              <Input
                placeholder="z.B. Hochzeit, Umzug, Pflege eines Angehörigen"
                value={specialLeaveReason}
                onChange={(e) => setSpecialLeaveReason(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Von</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  if (endDate < e.target.value) setEndDate(e.target.value)
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Bis</Label>
              <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {supportsHalfDay && startDate === endDate && (
            <div className="space-y-2">
              <Label>Umfang</Label>
              <Select value={dayPart} onValueChange={(v) => setDayPart(v as "full" | "half_am" | "half_pm")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Ganzer Tag</SelectItem>
                  <SelectItem value="half_am">Halber Tag (Vormittag)</SelectItem>
                  <SelectItem value="half_pm">Halber Tag (Nachmittag)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notiz (optional)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Speichere…" : "Abwesenheit eintragen"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
