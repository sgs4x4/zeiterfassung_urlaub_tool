"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import { Clock, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useSaveTimeEntry } from "@/hooks/queries/use-save-time-entry"
import { useDeleteTimeEntry } from "@/hooks/queries/use-delete-time-entry"
import type { WeekBoardData } from "@/app/actions/time-entries"

type BoardEntry = WeekBoardData["entries"][number]

interface EntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Tag, für den der Eintrag angelegt/bearbeitet wird. */
  date: Date
  /** Gesetzt = Bearbeiten, nicht gesetzt = Neuanlage. */
  entry?: BoardEntry | null
  projects: WeekBoardData["projects"]
  /** Tagessoll, wird als Platzhalter für die Stundeneingabe genutzt. */
  dayTarget?: number
}

export function EntryDialog({ open, onOpenChange, date, entry, projects, dayTarget }: EntryDialogProps) {
  const isEdit = !!entry

  const [projectId, setProjectId] = useState("")
  const [useTimeRange, setUseTimeRange] = useState(false)
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [hours, setHours] = useState("")
  const [description, setDescription] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  const saveEntry = useSaveTimeEntry()
  const deleteEntry = useDeleteTimeEntry()

  // Formular bei jedem Öffnen aus dem übergebenen Eintrag (oder leer) befüllen.
  useEffect(() => {
    if (!open) return

    setConfirmDelete(false)
    if (entry) {
      setProjectId(entry.project_id ?? "")
      setDescription(entry.description ?? "")
      setHours(String(entry.hours))
      const hasRange = !!entry.start_time && !!entry.end_time
      setUseTimeRange(hasRange)
      setStartTime(entry.start_time?.slice(0, 5) ?? "")
      setEndTime(entry.end_time?.slice(0, 5) ?? "")
    } else {
      setProjectId(projects.length === 1 ? projects[0].id : "")
      setDescription("")
      setHours("")
      setUseTimeRange(false)
      setStartTime("")
      setEndTime("")
    }
  }, [open, entry, projects])

  // Stunden aus Start-/Endzeit ableiten, solange der Zeitraum-Modus aktiv ist.
  useEffect(() => {
    if (!useTimeRange || !startTime || !endTime) return

    const [startH, startM] = startTime.split(":").map(Number)
    const [endH, endM] = endTime.split(":").map(Number)
    const diff = endH * 60 + endM - (startH * 60 + startM)

    if (diff > 0) {
      setHours((diff / 60).toFixed(2))
    }
  }, [useTimeRange, startTime, endTime])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const formData = new FormData()
    formData.set("date", format(date, "yyyy-MM-dd"))
    formData.set("hours", hours)
    formData.set("description", description)
    formData.set("project_id", projectId)
    if (entry) formData.set("entry_id", entry.id)
    if (useTimeRange && startTime && endTime) {
      formData.set("start_time", startTime)
      formData.set("end_time", endTime)
    }

    saveEntry.mutate(formData, {
      onSuccess: () => {
        toast.success(isEdit ? "Eintrag aktualisiert" : "Zeit erfasst")
        onOpenChange(false)
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "Fehler beim Speichern"),
    })
  }

  const handleDelete = () => {
    if (!entry) return

    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    deleteEntry.mutate(entry.id, {
      onSuccess: () => {
        toast.success("Eintrag gelöscht")
        onOpenChange(false)
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "Fehler beim Löschen"),
    })
  }

  const isBusy = saveEntry.isPending || deleteEntry.isPending
  const canSubmit = !isBusy && !!hours && !!projectId && (!useTimeRange || (!!startTime && !!endTime))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Eintrag bearbeiten" : "Zeit erfassen"}</DialogTitle>
          <DialogDescription>{format(date, "EEEE, d. MMMM yyyy", { locale: de })}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="entry-project">Projekt</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="entry-project" className="w-full">
                <SelectValue placeholder="Projekt wählen…" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: project.color || "var(--muted-foreground)" }}
                      />
                      {project.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="entry-range" className="text-sm font-medium">
                Start- und Endzeit
              </Label>
              <p className="text-xs text-muted-foreground">Stunden werden berechnet</p>
            </div>
            <Switch id="entry-range" checked={useTimeRange} onCheckedChange={setUseTimeRange} />
          </div>

          {useTimeRange ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="entry-start">Von</Label>
                <Input id="entry-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry-end">Bis</Label>
                <Input id="entry-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry-hours-calc">Stunden</Label>
                <Input id="entry-hours-calc" value={hours} disabled className="bg-muted/60 font-medium tabular-nums" />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="entry-hours">Stunden</Label>
              <Input
                id="entry-hours"
                type="number"
                step="0.25"
                min="0"
                max="24"
                inputMode="decimal"
                placeholder={dayTarget ? dayTarget.toFixed(2) : "8.0"}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="entry-description">Tätigkeit</Label>
            <Textarea
              id="entry-description"
              placeholder="Woran hast du gearbeitet?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant={confirmDelete ? "destructive" : "ghost"}
                onClick={handleDelete}
                disabled={isBusy}
                className={cn(!confirmDelete && "text-muted-foreground hover:text-destructive")}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {confirmDelete ? "Wirklich löschen?" : "Löschen"}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={!canSubmit}>
              <Clock className="mr-2 h-4 w-4" />
              {saveEntry.isPending ? "Speichere…" : isEdit ? "Speichern" : "Erfassen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
