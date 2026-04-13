"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, CalendarIcon, Pencil, Trash2, CheckCircle2, X, Clock, FileText, Plus } from "lucide-react"
import {
  updateTimeEntryAdmin,
  deleteTimeEntryAdmin,
  getUserClosedMonths,
  deleteMonthClosure,
} from "@/app/actions/admin"
import { saveTimeEntryForUser } from "@/app/actions/time-entries"
import { getProjects, type Project } from "@/app/actions/projects"
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { de } from "date-fns/locale"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { cn, formatHours } from "@/lib/utils"

interface TimeEntry {
  id: string
  user_id: string
  date: string
  hours: number
  description: string | null
  project: string | null
  project_id: string | null
  start_time: string | null
  end_time: string | null
  projects?: {
    name: string
    color: string
  }
}

interface User {
  id: string
  name: string
  email: string
}

interface ClosedMonth {
  id: string
  year: number
  month: number
}

export function UserEntriesView({
  userId,
  canManageEntries = false,
  canManageClosures = false,
}: {
  userId: string
  canManageEntries?: boolean
  canManageClosures?: boolean
}) {
  const [user, setUser] = useState<User | null>(null)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [closedMonths, setClosedMonths] = useState<ClosedMonth[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [filterStartDate, setFilterStartDate] = useState<Date>(startOfMonth(new Date()))
  const [filterEndDate, setFilterEndDate] = useState<Date>(endOfMonth(new Date()))

  // Edit state
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [editForm, setEditForm] = useState({
    hours: "",
    description: "",
    projectId: "",
    startTime: "",
    endTime: "",
  })

  // New entry state
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [newEntryDate, setNewEntryDate] = useState<Date>(new Date())
  const [newForm, setNewForm] = useState({
    hours: "",
    description: "",
    projectId: "",
    startTime: "",
    endTime: "",
  })
  const [useTimeRange, setUseTimeRange] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [filterStartDate, filterEndDate])

  // Auto-calc hours from time range
  useEffect(() => {
    if (useTimeRange && newForm.startTime && newForm.endTime) {
      const [sh, sm] = newForm.startTime.split(":").map(Number)
      const [eh, em] = newForm.endTime.split(":").map(Number)
      const diff = (eh * 60 + em - (sh * 60 + sm)) / 60
      if (diff > 0) setNewForm((f) => ({ ...f, hours: diff.toFixed(2) }))
    }
  }, [useTimeRange, newForm.startTime, newForm.endTime])

  // Pre-select single project
  useEffect(() => {
    const active = projects.filter((p) => p.is_active)
    if (active.length === 1 && !newForm.projectId) {
      setNewForm((f) => ({ ...f, projectId: active[0].id }))
    }
  }, [projects])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const start = format(filterStartDate, "yyyy-MM-dd")
      const end = format(filterEndDate, "yyyy-MM-dd")

      const supabase = createClient()
      const { data: userData } = await supabase.from("users").select("id, name, email").eq("id", userId).single()
      setUser(userData)

      const { data: entriesData } = await supabase
        .from("time_entries")
        .select(`*, projects (name, color)`)
        .eq("user_id", userId)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false })

      setEntries(entriesData || [])

      const [projectsData, closedData] = await Promise.all([getProjects(), getUserClosedMonths(userId)])
      setProjects(projectsData)
      setClosedMonths(closedData)
    } catch (error) {
      console.error("Fehler beim Laden:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewEntry = async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const formData = new FormData()
      formData.set("date", format(newEntryDate, "yyyy-MM-dd"))
      formData.set("hours", newForm.hours)
      formData.set("description", newForm.description)
      formData.set("project_id", newForm.projectId)
      if (useTimeRange && newForm.startTime && newForm.endTime) {
        formData.set("start_time", newForm.startTime)
        formData.set("end_time", newForm.endTime)
      }
      await saveTimeEntryForUser(userId, formData)
      setSaveMessage({ type: "success", text: "Eintrag gespeichert!" })
      setNewForm({ hours: "", description: "", projectId: "", startTime: "", endTime: "" })
      setUseTimeRange(false)
      setShowNewEntry(false)
      loadData()
    } catch (error) {
      setSaveMessage({ type: "error", text: error instanceof Error ? error.message : "Fehler beim Speichern" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditEntry = (entry: TimeEntry) => {
    setEditingEntry(entry)
    setEditForm({
      hours: entry.hours.toString(),
      description: entry.description || "",
      projectId: entry.project_id || "",
      startTime: entry.start_time || "",
      endTime: entry.end_time || "",
    })
  }

  const handleSaveEdit = async () => {
    if (!editingEntry) return
    try {
      const selectedProject = projects.find((p) => p.id === editForm.projectId)
      await updateTimeEntryAdmin(
        editingEntry.id,
        Number.parseFloat(editForm.hours),
        editForm.description,
        selectedProject?.name || "",
        editForm.projectId || undefined,
      )
      setEditingEntry(null)
      loadData()
    } catch (error) {
      console.error("Fehler beim Speichern:", error)
      alert("Fehler beim Speichern")
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm("Eintrag wirklich löschen?")) return
    try {
      await deleteTimeEntryAdmin(entryId)
      loadData()
    } catch (error) {
      console.error("Fehler beim Löschen:", error)
    }
  }

  const handleDeleteClosure = async (closureId: string, month: number, year: number) => {
    if (!confirm(`Abschluss von ${month}/${year} wirklich löschen?`)) return
    try {
      await deleteMonthClosure(closureId)
      loadData()
    } catch (error) {
      console.error("Fehler beim Löschen:", error)
    }
  }

  const setThisMonth = () => {
    setFilterStartDate(startOfMonth(new Date()))
    setFilterEndDate(endOfMonth(new Date()))
  }

  const setLastMonth = () => {
    const lastMonth = subMonths(new Date(), 1)
    setFilterStartDate(startOfMonth(lastMonth))
    setFilterEndDate(endOfMonth(lastMonth))
  }

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0)
  const entriesByDate = entries.reduce((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = []
    acc[entry.date].push(entry)
    return acc
  }, {} as Record<string, TimeEntry[]>)

  if (isLoading) {
    return (
      <div className="p-2">
        <div className="text-center py-12 text-muted-foreground">Lade Daten...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Zeiteinträge von {user?.name}</h1>
            <p className="text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!canManageEntries && !canManageClosures && (
            <span className="rounded-md border border-border/70 bg-card/90 px-2.5 py-1 text-xs text-muted-foreground">
              Nur Lesezugriff
            </span>
          )}
          {canManageEntries && (
            <Button onClick={() => setShowNewEntry(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Neuer Eintrag
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={setThisMonth}>
            Aktueller Monat
          </Button>
          <Button variant="outline" size="sm" onClick={setLastMonth}>
            Letzter Monat
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(filterStartDate, "dd.MM.yyyy")} – {format(filterEndDate, "dd.MM.yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
              <div className="space-y-4">
                <div>
                  <Label>Von</Label>
                  <Calendar mode="single" selected={filterStartDate} onSelect={(d) => d && setFilterStartDate(d)} locale={de} />
                </div>
                <div>
                  <Label>Bis</Label>
                  <Calendar mode="single" selected={filterEndDate} onSelect={(d) => d && setFilterEndDate(d)} locale={de} />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Abgeschlossene Monate */}
      {closedMonths.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Abgeschlossene Monate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {closedMonths.map((closure) => (
                <div
                  key={closure.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg text-sm border border-green-500/20"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">
                    {format(new Date(closure.year, closure.month - 1), "MMMM yyyy", { locale: de })}
                  </span>
                  {canManageClosures && (
                    <button
                      onClick={() => handleDeleteClosure(closure.id, closure.month, closure.year)}
                      className="hover:bg-red-500/20 rounded p-0.5 transition-colors"
                      title="Abschluss löschen"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Zusammenfassung */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatHours(totalHours)}</div>
            <p className="text-sm text-muted-foreground">Gesamtstunden</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{entries.length}</div>
            <p className="text-sm text-muted-foreground">Einträge</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{Object.keys(entriesByDate).length}</div>
            <p className="text-sm text-muted-foreground">Tage mit Einträgen</p>
          </CardContent>
        </Card>
      </div>

      {/* Zeiteinträge Tabelle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Zeiteinträge
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Keine Einträge im ausgewählten Zeitraum</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Uhrzeit</TableHead>
                  <TableHead>Projekt</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead className="text-right">Stunden</TableHead>
                  {canManageEntries && <TableHead className="text-right">Aktionen</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{format(new Date(entry.date), "dd.MM.yyyy")}</TableCell>
                    <TableCell>
                      {entry.start_time && entry.end_time ? (
                        <span className="text-sm flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {entry.start_time.slice(0, 5)} – {entry.end_time.slice(0, 5)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.projects ? (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-primary/40" />
                          <span>{entry.projects.name}</span>
                        </div>
                      ) : entry.project ? (
                        <span>{entry.project}</span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{entry.description || "–"}</TableCell>
                    <TableCell className="text-right font-semibold">{formatHours(Number(entry.hours))}</TableCell>
                    {canManageEntries && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditEntry(entry)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteEntry(entry.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Entry Dialog */}
      <Dialog open={canManageEntries && showNewEntry} onOpenChange={(open) => { setShowNewEntry(open); setSaveMessage(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Neuer Eintrag für {user?.name}</DialogTitle>
            <DialogDescription>
              Als Admin kannst du Zeiteinträge im Namen dieses Mitarbeiters erstellen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Datum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(newEntryDate, "PPP", { locale: de })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newEntryDate}
                    onSelect={(d) => d && setNewEntryDate(d)}
                    locale={de}
                    disabled={(d) => d > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Projekt</Label>
              <Select value={newForm.projectId} onValueChange={(v) => setNewForm((f) => ({ ...f, projectId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Projekt auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.filter((p) => p.is_active).map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-primary/40" />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-accent/20">
              <div>
                <p className="text-sm font-medium">Start-/Endzeit erfassen</p>
                <p className="text-xs text-muted-foreground">Stunden werden automatisch berechnet</p>
              </div>
              <Switch checked={useTimeRange} onCheckedChange={setUseTimeRange} />
            </div>

            {useTimeRange ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Startzeit</Label>
                  <Input
                    type="time"
                    value={newForm.startTime}
                    onChange={(e) => setNewForm((f) => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Endzeit</Label>
                  <Input
                    type="time"
                    value={newForm.endTime}
                    onChange={(e) => setNewForm((f) => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stunden</Label>
                  <Input type="number" step="0.25" value={newForm.hours} readOnly className="bg-muted" />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Stunden</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  placeholder="8.00"
                  value={newForm.hours}
                  onChange={(e) => setNewForm((f) => ({ ...f, hours: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea
                placeholder="Tätigkeitsbeschreibung..."
                value={newForm.description}
                onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>

            {saveMessage && (
              <div className={cn(
                "p-3 rounded-md text-sm",
                saveMessage.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
              )}>
                {saveMessage.text}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewEntry(false)}>Abbrechen</Button>
              <Button
                onClick={handleNewEntry}
                disabled={isSaving || !newForm.hours || (useTimeRange && (!newForm.startTime || !newForm.endTime))}
              >
                {isSaving ? "Speichere..." : "Eintrag speichern"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={canManageEntries && !!editingEntry} onOpenChange={() => setEditingEntry(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Eintrag bearbeiten</DialogTitle>
            <DialogDescription>
              {editingEntry && format(new Date(editingEntry.date), "EEEE, dd. MMMM yyyy", { locale: de })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Stunden</Label>
              <Input
                type="number"
                step="0.25"
                value={editForm.hours}
                onChange={(e) => setEditForm({ ...editForm, hours: e.target.value })}
              />
            </div>
            <div>
              <Label>Projekt</Label>
              <Select value={editForm.projectId} onValueChange={(v) => setEditForm({ ...editForm, projectId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Projekt auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {projects.filter((p) => p.is_active).map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-primary/40" />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Startzeit (optional)</Label>
                <Input
                  type="time"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                />
              </div>
              <div>
                <Label>Endzeit (optional)</Label>
                <Input
                  type="time"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditingEntry(null)}>Abbrechen</Button>
              <Button onClick={handleSaveEdit}>Speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
