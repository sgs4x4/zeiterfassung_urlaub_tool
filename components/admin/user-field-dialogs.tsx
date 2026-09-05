"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateUserBundesland, updateUserCategory, updateUserVacationDays } from "@/app/actions/admin"
import { assignProjectsToUser, getAllProjects, getUserProjectIds, type Project } from "@/app/actions/projects"
import { USER_CATEGORY_LABELS, type User, type UserCategory } from "@/lib/db"
import { BUNDESLAENDER, type Bundesland } from "@/lib/holidays"

/**
 * Die vier schlanken Stammdaten-Dialoge der Mitarbeiterverwaltung. Bewusst zusammen in einer
 * Datei: jeder für sich ist zu klein für ein eigenes Modul, gemeinsam bleiben sie überschaubar
 * und halten admin-user-list.tsx frei.
 */

export function CategoryDialog({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved?: () => void }) {
  const [value, setValue] = useState<UserCategory>("sonstiges")

  useEffect(() => {
    if (user) setValue((user.category as UserCategory) || "sonstiges")
  }, [user])

  const handleSave = async () => {
    if (!user) return
    try {
      await updateUserCategory(user.id, value)
      onSaved?.()
      onClose()
    } catch (error) {
      console.error("Fehler beim Aktualisieren der Teams:", error)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Team-Zuordnung ändern</DialogTitle>
          <DialogDescription>
            Lege fest, welchem Team <strong>{user?.name}</strong> zugeordnet ist.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Team</Label>
            <Select value={value} onValueChange={(v) => setValue(v as UserCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(USER_CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Die Team-Zuordnung steuert Urlaubsregeln und Auswertungen.</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
            <Button variant="outline" onClick={onClose}>
              Schließen
            </Button>
            <Button onClick={handleSave}>Änderung speichern</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function VacationDaysDialog({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved?: () => void }) {
  const [value, setValue] = useState("30")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setValue((user.vacation_days_per_year || 30).toString())
      setError(null)
    }
  }, [user])

  const handleSave = async () => {
    if (!user) return
    setError(null)
    try {
      await updateUserVacationDays(user.id, Number.parseFloat(value))
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern")
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Urlaubskontingent ändern</DialogTitle>
          <DialogDescription>
            Definiere das jährliche Urlaubskontingent für <strong>{user?.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Urlaubstage / Jahr</Label>
            <Input type="number" step="0.5" min="0" max="60" value={value} onChange={(e) => setValue(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Gilt für das laufende Kalenderjahr. Sonderurlaub und Überstundenausgleich werden hiervon nicht abgezogen.
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
            <Button variant="outline" onClick={onClose}>
              Schließen
            </Button>
            <Button onClick={handleSave}>Änderung speichern</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function BundeslandDialog({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved?: () => void }) {
  const [value, setValue] = useState<Bundesland>("BY")

  useEffect(() => {
    if (user) setValue((user.bundesland as Bundesland) || "BY")
  }, [user])

  const handleSave = async () => {
    if (!user) return
    try {
      await updateUserBundesland(user.id, value)
      onSaved?.()
      onClose()
    } catch (error) {
      console.error("Fehler beim Aktualisieren:", error)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bundesland & Feiertage</DialogTitle>
          <DialogDescription>
            Das Bundesland steuert, welche Feiertage für <strong>{user?.name}</strong> gelten.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Bundesland</Label>
            <Select value={value} onValueChange={(v) => setValue(v as Bundesland)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BUNDESLAENDER).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label as string}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Feiertage reduzieren das taggenaue Monats-Soll automatisch.
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
            <Button variant="outline" onClick={onClose}>
              Schließen
            </Button>
            <Button onClick={handleSave}>Änderung speichern</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ProjectsDialog({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved?: () => void }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([getAllProjects(), getUserProjectIds(user.id)])
      .then(([allProjects, assignedIds]) => {
        if (cancelled) return
        setProjects(allProjects)
        setSelectedIds(assignedIds)
      })
      .catch((error) => console.error("Fehler beim Laden der Projekte:", error))
    return () => {
      cancelled = true
    }
  }, [user])

  const toggle = (projectId: string) =>
    setSelectedIds((prev) => (prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]))

  const handleSave = async () => {
    if (!user) return
    try {
      await assignProjectsToUser(user.id, selectedIds)
      onSaved?.()
      onClose()
    } catch (error) {
      console.error("Fehler beim Aktualisieren:", error)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Projekte zuweisen</DialogTitle>
          <DialogDescription>
            Wähle die Projekte, auf die <strong>{user?.name}</strong> buchen darf. Ohne Auswahl kann auf alle Projekte
            gebucht werden.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[400px] space-y-2 overflow-y-auto">
          {projects.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Keine Projekte vorhanden</p>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
                onClick={() => toggle(project.id)}
              >
                <Checkbox checked={selectedIds.includes(project.id)} onCheckedChange={() => toggle(project.id)} />
                <div className="h-3 w-3 shrink-0 rounded-full bg-primary/40" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{project.name}</p>
                  {project.description && <p className="text-xs text-muted-foreground">{project.description}</p>}
                </div>
                {!project.is_active && (
                  <Badge variant="secondary" className="text-xs">
                    Inaktiv
                  </Badge>
                )}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border/70 pt-4">
          <p className="text-sm text-muted-foreground">
            {selectedIds.length} von {projects.length} ausgewählt
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Schließen
            </Button>
            <Button onClick={handleSave}>Änderung speichern</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
