"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Trash2, TrendingDown, TrendingUp, Minus, Lock } from "lucide-react"
import {
  createOvertimeAdjustment,
  deleteOvertimeAdjustment,
  getAdminOvertimeBalance,
  getOvertimeAdjustments,
  updateUserOvertimeTrackingStart,
} from "@/app/actions/admin"
import { formatHours } from "@/lib/utils"

type Adjustment = Awaited<ReturnType<typeof getOvertimeAdjustments>>[number]

const TYPE_LABELS: Record<Adjustment["type"], string> = {
  payout: "Auszahlung",
  compensation: "Freizeitausgleich",
  correction: "Korrektur",
  opening_balance: "Startsaldo",
}

/**
 * Überstundenkonto eines Mitarbeiters: aktueller Saldo, vollständige Buchungshistorie und
 * manuelle Buchungen (Auszahlung, Korrektur). Buchungen, die aus einem genehmigten
 * Ausgleichsantrag stammen, sind hier bewusst schreibgeschützt – sie hängen am Antrag.
 */
export function OvertimeAccountDialog({
  user,
  onClose,
  onChanged,
}: {
  user: { id: string; name: string; overtime_tracking_start_date?: string | null } | null
  onClose: () => void
  onChanged?: () => void
}) {
  const [balance, setBalance] = useState<number | null>(null)
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null)

  const [trackingStart, setTrackingStart] = useState<Date>(new Date())
  const [isSavingTrackingStart, setIsSavingTrackingStart] = useState(false)

  const [newDate, setNewDate] = useState<Date>(new Date())
  const [newType, setNewType] = useState<"payout" | "correction">("payout")
  const [newHours, setNewHours] = useState("")
  const [newReason, setNewReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const userId = user?.id ?? null

  const load = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    try {
      const [balanceData, adjustmentData] = await Promise.all([
        getAdminOvertimeBalance(userId),
        getOvertimeAdjustments(userId),
      ])
      setBalance(balanceData)
      setAdjustments(adjustmentData)
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Fehler beim Laden" })
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!user) return
    setMessage(null)
    setNewHours("")
    setNewReason("")
    setNewDate(new Date())
    setNewType("payout")
    setTrackingStart(user.overtime_tracking_start_date ? new Date(user.overtime_tracking_start_date) : new Date())
    load()
  }, [user, load])

  const handleSaveTrackingStart = async () => {
    if (!userId) return
    setIsSavingTrackingStart(true)
    setMessage(null)
    try {
      await updateUserOvertimeTrackingStart(userId, format(trackingStart, "yyyy-MM-dd"))
      setMessage({ type: "success", text: "Trackingbeginn gespeichert." })
      await load()
      onChanged?.()
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Fehler beim Speichern" })
    } finally {
      setIsSavingTrackingStart(false)
    }
  }

  const handleCreate = async () => {
    if (!userId) return
    setIsSaving(true)
    setMessage(null)
    try {
      await createOvertimeAdjustment(userId, {
        effectiveDate: format(newDate, "yyyy-MM-dd"),
        hours: Number.parseFloat(newHours.replace(",", ".")),
        type: newType,
        reason: newReason,
      })
      setNewHours("")
      setNewReason("")
      setMessage({ type: "success", text: "Buchung angelegt." })
      await load()
      onChanged?.()
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Fehler beim Speichern" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (adjustmentId: string) => {
    if (!confirm("Buchung wirklich löschen?")) return
    setMessage(null)
    try {
      await deleteOvertimeAdjustment(adjustmentId)
      await load()
      onChanged?.()
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Fehler beim Löschen" })
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Überstundenkonto</DialogTitle>
          <DialogDescription>
            Saldo, Buchungen und Trackingbeginn für <strong>{user?.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Saldo */}
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Aktueller Saldo</p>
            <div
              className={`mt-1 flex items-center gap-2 text-3xl font-bold ${
                balance === null
                  ? ""
                  : balance > 0
                    ? "text-green-600 dark:text-green-400"
                    : balance < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
              }`}
            >
              {balance === null ? (
                isLoading ? "Lade…" : "–"
              ) : (
                <>
                  {balance > 0 && <TrendingUp className="h-6 w-6" />}
                  {balance < 0 && <TrendingDown className="h-6 w-6" />}
                  {balance === 0 && <Minus className="h-6 w-6" />}
                  {(balance > 0 ? "+" : "") + formatHours(balance)}
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Erfasste Zeit gegen taggenaues Soll (ohne Feiertage und genehmigte Abwesenheiten), zuzüglich aller
              Buchungen unten.
            </p>
          </div>

          {message && (
            <Alert variant={message.type === "error" ? "destructive" : "default"}>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          {/* Neue Buchung */}
          <div className="space-y-3 rounded-lg border border-border/70 p-4">
            <p className="text-sm font-semibold">Buchung hinzufügen</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Art</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as "payout" | "correction")}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payout">Auszahlung (reduziert)</SelectItem>
                    <SelectItem value="correction">Korrektur (+/–)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Stunden</Label>
                <Input
                  type="number"
                  step="0.25"
                  placeholder={newType === "payout" ? "z.B. 20" : "z.B. -5 oder 5"}
                  className="h-9"
                  value={newHours}
                  onChange={(e) => setNewHours(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Wirksam am</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {format(newDate, "dd.MM.yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={newDate} onSelect={(d) => d && setNewDate(d)} locale={de} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Grund (Pflicht)</Label>
              <Textarea
                rows={2}
                placeholder="z.B. Auszahlung mit Abrechnung 09/2026 laut Absprache"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleCreate} disabled={isSaving || !newHours || !newReason.trim()}>
                {isSaving ? "Speichere…" : "Buchung anlegen"}
              </Button>
            </div>
          </div>

          {/* Historie */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Buchungshistorie</p>
            {adjustments.length === 0 ? (
              <p className="rounded-md border border-dashed border-border/70 p-4 text-center text-sm text-muted-foreground">
                Noch keine Buchungen.
              </p>
            ) : (
              <div className="divide-y divide-border/70 rounded-md border border-border/70">
                {adjustments.map((adjustment) => (
                  <div key={adjustment.id} className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">
                          {adjustment.hours > 0 ? "+" : ""}
                          {formatHours(adjustment.hours)}
                        </span>
                        <span className="rounded border border-border/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {TYPE_LABELS[adjustment.type]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(adjustment.effectiveDate), "dd.MM.yyyy")}
                        </span>
                      </div>
                      {adjustment.reason && <p className="mt-0.5 truncate text-xs text-muted-foreground">{adjustment.reason}</p>}
                      {adjustment.createdByName && (
                        <p className="text-[10px] text-muted-foreground">gebucht von {adjustment.createdByName}</p>
                      )}
                    </div>
                    {adjustment.absenceId ? (
                      <span
                        className="mt-0.5 shrink-0 text-muted-foreground"
                        title="Gehört zu einem genehmigten Ausgleichsantrag – über den Antrag ändern"
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => handleDelete(adjustment.id)}
                        title="Buchung löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trackingbeginn */}
          <div className="space-y-2 rounded-lg border border-border/70 p-4">
            <Label className="text-sm font-semibold">Zeiterfassung zählt ab</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {format(trackingStart, "PPP", { locale: de })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={trackingStart}
                    onSelect={(d) => d && setTrackingStart(d)}
                    locale={de}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button size="sm" variant="outline" onClick={handleSaveTrackingStart} disabled={isSavingTrackingStart}>
                {isSavingTrackingStart ? "Speichere…" : "Übernehmen"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Monate davor zählen nicht in den Saldo – z.B. weil das Tool erst ab dann zuverlässig genutzt wurde.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
