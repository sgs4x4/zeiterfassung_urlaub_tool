"use client"

import type React from "react"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Plus, Pencil, Trash2, Check, X, Users, Search, FolderKanban, Filter } from "lucide-react"
import { createProject, updateProject, deleteProject, getUserProjectIds, assignProjectsToUser, type Project } from "@/app/actions/projects"
import { fetchAllUsers } from "@/app/actions/admin"
import type { User } from "@/lib/db"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ProjectManagerProps {
  projects: Project[]
}

export function ProjectManager({ projects: initialProjects }: ProjectManagerProps) {
  const router = useRouter()
  const [projects, setProjects] = useState(initialProjects)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [assigningProjectId, setAssigningProjectId] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")

  const loadProjects = async () => {
    try {
      const { getAllProjects } = await import("@/app/actions/projects")
      const updatedProjects = await getAllProjects()
      setProjects(updatedProjects)
    } catch (error) {
      console.error("Fehler beim Laden der Projekte:", error)
    }
  }

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      await createProject(formData)
      setIsAdding(false)
      await loadProjects()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Fehler beim Erstellen")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (id: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      await updateProject(id, formData)
      setEditingId(null)
      await loadProjects()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Fehler beim Aktualisieren")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Projekt wirklich deaktivieren?")) return

    setLoading(true)
    try {
      await deleteProject(id)
      await loadProjects()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Fehler beim Löschen")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenUserAssignment = async (projectId: string) => {
    setAssigningProjectId(projectId)
    try {
      const users = await fetchAllUsers()
      setAllUsers(users)
      // Load currently assigned users for this project
      const assignedIds: string[] = []
      for (const user of users) {
        const userProjectIds = await getUserProjectIds(user.id)
        if (userProjectIds.includes(projectId)) {
          assignedIds.push(user.id)
        }
      }
      setSelectedUserIds(assignedIds)
    } catch (error) {
      console.error("Fehler beim Laden der User:", error)
    }
  }

  const handleSaveUserAssignment = async () => {
    if (!assigningProjectId) return

    setLoading(true)
    try {
      // Update all users for this project
      for (const user of allUsers) {
        const isSelected = selectedUserIds.includes(user.id)
        const userProjectIds = await getUserProjectIds(user.id)
        const currentlyAssigned = userProjectIds.includes(assigningProjectId)

        if (isSelected && !currentlyAssigned) {
          // Add project
          await assignProjectsToUser(user.id, [...userProjectIds, assigningProjectId])
        } else if (!isSelected && currentlyAssigned) {
          // Remove project
          await assignProjectsToUser(user.id, userProjectIds.filter(id => id !== assigningProjectId))
        }
      }
      setAssigningProjectId(null)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Fehler beim Speichern")
    } finally {
      setLoading(false)
    }
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const filteredProjects = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase()
    return projects.filter((project) => {
      const matchesSearch =
        normalized.length === 0 ||
        project.name.toLowerCase().includes(normalized) ||
        (project.description || "").toLowerCase().includes(normalized)
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && project.is_active) ||
        (statusFilter === "inactive" && !project.is_active)
      return matchesSearch && matchesStatus
    })
  }, [projects, searchTerm, statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Projekte ({filteredProjects.length})</h2>
          {filteredProjects.length !== projects.length && (
            <Badge variant="secondary" className="text-xs">von {projects.length}</Badge>
          )}
        </div>
        <Button onClick={() => setIsAdding(true)} disabled={isAdding || loading} size="sm" className="h-9">
          <Plus className="mr-2 h-4 w-4" />
          Neues Projekt
        </Button>
      </div>

      <Card className="p-4 border-border/70 bg-card/90">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              placeholder="Nach Projektname oder Beschreibung suchen"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as "all" | "active" | "inactive")}
          >
            <SelectTrigger>
              <Filter className="mr-2 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Projekte</SelectItem>
              <SelectItem value="active">Nur aktive</SelectItem>
              <SelectItem value="inactive">Nur inaktive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isAdding && (
        <Card className="p-4 border-border/70 bg-card/90">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Projektname *</label>
              <Input name="name" required placeholder="z.B. Kundenservice" />
            </div>
            <div>
              <label className="text-sm font-medium">Beschreibung</label>
              <Textarea name="description" placeholder="Optional" rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium">Farbe</label>
              <Input name="color" type="color" defaultValue="#6B7280" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading} size="sm">
                <Check className="mr-2 h-4 w-4" />
                Speichern
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsAdding(false)} disabled={loading} size="sm">
                <X className="mr-2 h-4 w-4" />
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-4">
        {filteredProjects.map((project) => (
          <Card key={project.id} className="p-4 border-border/70 bg-card/90">
            {editingId === project.id ? (
              <form onSubmit={(e) => handleUpdate(project.id, e)} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Projektname *</label>
                  <Input name="name" defaultValue={project.name} required />
                </div>
                <div>
                  <label className="text-sm font-medium">Beschreibung</label>
                  <Textarea name="description" defaultValue={project.description || ""} rows={2} />
                </div>
                <div>
                  <label className="text-sm font-medium">Farbe</label>
                  <Input name="color" type="color" defaultValue={project.color || "#6B7280"} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_active"
                    value="true"
                    defaultChecked={project.is_active}
                    id={`active-${project.id}`}
                  />
                  <label htmlFor={`active-${project.id}`} className="text-sm">
                    Aktiv
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={loading} size="sm">
                    <Check className="mr-2 h-4 w-4" />
                    Speichern
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                    disabled={loading}
                    size="sm"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Abbrechen
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-primary/40" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{project.name}</h3>
                      {project.is_active ? (
                        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400">
                          Aktiv
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Inaktiv</Badge>
                      )}
                    </div>
                    {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingId(project.id)} disabled={loading}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenUserAssignment(project.id)}
                    disabled={loading}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(project.id)}
                    disabled={loading || !project.is_active}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}

        {filteredProjects.length === 0 && (
          <Card className="p-10 border-dashed text-center border-border/70 bg-card/60">
            <p className="text-sm text-muted-foreground">Keine Projekte für den aktuellen Filter gefunden.</p>
          </Card>
        )}
      </div>

      {/* User Assignment Dialog */}
      <Dialog open={!!assigningProjectId} onOpenChange={() => setAssigningProjectId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Benutzer zuweisen</DialogTitle>
            <DialogDescription>
              Wähle die Benutzer, die auf dieses Projekt buchen dürfen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {allUsers.length === 0 ? (
              <p className="text-muted-foreground text-sm">Keine Benutzer vorhanden</p>
            ) : (
              allUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
                  onClick={() => toggleUserSelection(user.id)}
                >
                  <Checkbox
                    checked={selectedUserIds.includes(user.id)}
                    onCheckedChange={() => toggleUserSelection(user.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setAssigningProjectId(null)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveUserAssignment} disabled={loading}>
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
