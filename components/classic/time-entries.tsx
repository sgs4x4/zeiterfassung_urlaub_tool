"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Trash2, FileText, Clock, ChevronDown, ChevronUp } from "lucide-react"
import { getProjects, type Project } from "@/app/actions/projects"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { formatHours } from "@/lib/utils"
import { de } from "date-fns/locale"
import type { TimeEntry } from "@/lib/db"
import { useTimeEntries } from "@/hooks/queries/use-time-entries"
import { useDeleteTimeEntry } from "@/hooks/queries/use-delete-time-entry"

export function TimeEntries() {
  const [showAllEntries, setShowAllEntries] = useState(false)

  const now = new Date()
  // Geteilter Query-Cache mit der BETA-Ansicht: kein eigenes Polling, kein Event-Bus.
  const { data: entries = [], isLoading } = useTimeEntries(
    format(startOfMonth(now), "yyyy-MM-dd"),
    format(endOfMonth(now), "yyyy-MM-dd"),
  )
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: getProjects })
  const deleteTimeEntry = useDeleteTimeEntry()

  const handleDelete = (id: string) => {
    if (!confirm("Eintrag wirklich löschen?")) return
    deleteTimeEntry.mutate(id, {
      onSuccess: () => toast.success("Eintrag gelöscht"),
      onError: (error) => toast.error(error instanceof Error ? error.message : "Fehler beim Löschen"),
    })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) {
      return "Heute"
    }
    if (format(date, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd")) {
      return "Gestern"
    }
    return format(date, "EEEE, d. MMMM", { locale: de })
  }

  const formatTime = (time: string | null) => {
    if (!time) return null
    return time.substring(0, 5) // HH:MM
  }

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return null
    const project = projects.find((p: Project) => p.id === projectId)
    return project?.name || null
  }

  const getProjectColor = (projectId: string | null) => {
    if (!projectId) return null
    const project = projects.find((p: Project) => p.id === projectId)
    return project?.color || null
  }

  const groupedEntries = entries.reduce(
    (acc, entry) => {
      if (!acc[entry.date]) {
        acc[entry.date] = []
      }
      acc[entry.date].push(entry)
      return acc
    },
    {} as Record<string, TimeEntry[]>,
  )

  const today = format(new Date(), "yyyy-MM-dd")
  const filteredGroupedEntries = showAllEntries
    ? groupedEntries
    : Object.fromEntries(Object.entries(groupedEntries).filter(([date]) => date === today))

  const hasOlderEntries = Object.keys(groupedEntries).some((date) => date !== today)
  const olderEntriesCount = Object.keys(groupedEntries).length - (groupedEntries[today] ? 1 : 0)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Meine Einträge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">Lade Einträge...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Meine Einträge diesen Monat
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Noch keine Einträge vorhanden</p>
            <p className="text-sm">Erfasse deine erste Arbeitszeit!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(filteredGroupedEntries)
              .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
              .map(([date, dayEntries]) => {
                const totalHours = dayEntries.reduce((sum, e) => sum + Number(e.hours), 0)

                return (
                  <div key={date} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-muted-foreground">{formatDate(date)}</h3>
                      <span className="text-sm font-semibold text-primary">Gesamt: {formatHours(totalHours)}</span>
                    </div>
                    <div className="space-y-2">
                      {dayEntries.map((entry) => {
                        const projectName = getProjectName(entry.project_id)
                        const projectColor = getProjectColor(entry.project_id)
                        const startTimeFormatted = formatTime(entry.start_time)
                        const endTimeFormatted = formatTime(entry.end_time)

                        return (
                          <div
                            key={entry.id}
                            className="flex items-start justify-between p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {projectName && (
                                  <span
                                    className="text-xs px-2 py-0.5 rounded font-medium"
                                    style={{
                                      backgroundColor: projectColor ? `${projectColor}20` : undefined,
                                      color: projectColor || undefined,
                                    }}
                                  >
                                    {projectName}
                                  </span>
                                )}
                                {startTimeFormatted && endTimeFormatted && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {startTimeFormatted} - {endTimeFormatted}
                                  </span>
                                )}
                              </div>
                              {entry.description && (
                                <p className="text-sm text-muted-foreground">{entry.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-lg min-w-[60px] text-right">{formatHours(Number(entry.hours))}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(entry.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            {hasOlderEntries && (
              <Button
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => setShowAllEntries(!showAllEntries)}
              >
                {showAllEntries ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Nur heutige Einträge anzeigen
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Alle Einträge anzeigen ({olderEntriesCount} weitere Tage)
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
