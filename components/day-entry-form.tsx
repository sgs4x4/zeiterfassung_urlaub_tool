"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CalendarIcon, Clock, Save, Lock } from "lucide-react"
import { saveTimeEntry } from "@/app/actions/time-entries"
import { format, subDays } from "date-fns"
import { de } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { timeEntryEvents } from "@/lib/events"
import { getUserProjects, type Project } from "@/app/actions/projects"
import { Switch } from "@/components/ui/switch"
import { isMonthClosed } from "@/app/actions/month-closure"

interface DayEntryFormProps {
  isAdmin?: boolean
}

export function DayEntryForm({ isAdmin = false }: DayEntryFormProps) {
  const router = useRouter()
  const [date, setDate] = useState<Date>(new Date())
  const [hours, setHours] = useState("")
  const [description, setDescription] = useState("")
  const [projectId, setProjectId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedMonthClosed, setSelectedMonthClosed] = useState(false)

  const [useTimeRange, setUseTimeRange] = useState(false)
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const data = await getUserProjects()
      setProjects(data)
      // Pre-select if user has only one project
      if (data.length === 1 && !projectId) {
        setProjectId(data[0].id)
      }
    } catch (error) {
      console.error("Error loading projects:", error)
    }
  }

  useEffect(() => {
    if (useTimeRange && startTime && endTime) {
      const [startH, startM] = startTime.split(":").map(Number)
      const [endH, endM] = endTime.split(":").map(Number)

      const startMinutes = startH * 60 + startM
      const endMinutes = endH * 60 + endM

      if (endMinutes > startMinutes) {
        const calculatedHours = ((endMinutes - startMinutes) / 60).toFixed(2)
        setHours(calculatedHours)
      }
    }
  }, [useTimeRange, startTime, endTime])

  useEffect(() => {
    const checkMonthClosed = async () => {
      const closed = await isMonthClosed(date.getFullYear(), date.getMonth() + 1)
      setSelectedMonthClosed(closed)
    }
    checkMonthClosed()
  }, [date])

  const minDate = isAdmin ? undefined : subDays(new Date(), 5)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedMonthClosed && !isAdmin) {
      setMessage({ type: "error", text: "Dieser Monat wurde bereits abgeschlossen" })
      return
    }

    setIsLoading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.set("date", format(date, "yyyy-MM-dd"))
      formData.set("hours", hours)
      formData.set("description", description)
      formData.set("project_id", projectId)

      if (useTimeRange && startTime && endTime) {
        formData.set("start_time", startTime)
        formData.set("end_time", endTime)
      }

      await saveTimeEntry(formData)
      setMessage({ type: "success", text: "Zeiteintrag gespeichert!" })
      setHours("")
      setDescription("")
      setProjectId("")
      setStartTime("")
      setEndTime("")
      // Trigger update for all listening components
      timeEntryEvents.emit()
      router.refresh()
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Fehler beim Speichern" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Clock className="h-5 w-5 text-primary" />
          Zeit erfassen
        </CardTitle>
        <p className="text-sm text-muted-foreground">Arbeitszeit in unter einer Minute eintragen.</p>
      </CardHeader>
      <CardContent>
        {selectedMonthClosed && !isAdmin && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <Lock className="h-4 w-4" />
            Dieser Monat wurde abgeschlossen. Admins können weiterhin Änderungen vornehmen.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Datum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: de }) : "Datum wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    locale={de}
                    disabled={(date) => (minDate ? date < minDate || date > new Date() : date > new Date())}
                  />
                </PopoverContent>
              </Popover>
              {!isAdmin && <p className="text-xs text-muted-foreground">Maximal 5 Tage rückwirkend möglich</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="project">Projekt</Label>
              <select
                id="project"
                aria-label="Projekt"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
              >
                <option value="">Projekt wählen...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-accent/30 p-3.5">
            <div className="space-y-0.5">
              <Label htmlFor="use-time-range" className="text-sm font-medium">
                Start-/Endzeit erfassen
              </Label>
              <p className="text-xs text-muted-foreground">Stunden werden automatisch berechnet</p>
            </div>
            <Switch id="use-time-range" checked={useTimeRange} onCheckedChange={setUseTimeRange} />
          </div>

          {useTimeRange ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="start-time">Startzeit</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required={useTimeRange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">Endzeit</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required={useTimeRange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hours">Stunden (berechnet)</Label>
                <Input
                  id="hours"
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  placeholder="0.0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  required
                  disabled
                  className="bg-muted/70"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="hours">Stunden</Label>
              <Input
                id="hours"
                type="number"
                step="0.25"
                min="0"
                max="24"
                placeholder="8.0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Tätigkeitsbeschreibung</Label>
            <Textarea
              id="description"
              placeholder="Was hast du an diesem Tag gemacht?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {message && (
            <div
              className={cn(
                "rounded-lg border p-3 text-sm",
                message.type === "success"
                  ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-destructive/30 bg-destructive/10 text-destructive",
              )}
            >
              {message.text}
            </div>
          )}

          <Button
            type="submit"
            className="h-11 w-full shadow-sm"
            disabled={
              isLoading || !hours || (useTimeRange && (!startTime || !endTime)) || (selectedMonthClosed && !isAdmin)
            }
          >
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? "Speichere..." : "Eintrag speichern"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
