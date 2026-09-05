"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getUserAccessConfig, saveUserAccessConfig } from "@/app/actions/admin"
import { buildPermissionMap, type AccessProfile, type AppPermission, type PermissionGroup } from "@/lib/permissions"
import type { User } from "@/lib/db"

/** Zugriffsprofil und Einzelberechtigungen eines Mitarbeiters. */
export function AccessDialog({
  user,
  onClose,
  onSaved,
}: {
  user: User | null
  onClose: () => void
  onSaved?: () => void
}) {
  const [profile, setProfile] = useState<AccessProfile>("employee")
  const [permissions, setPermissions] = useState<Partial<Record<AppPermission, boolean>>>({})
  const [groups, setGroups] = useState<PermissionGroup[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getUserAccessConfig(user.id)
      .then((config) => {
        if (cancelled) return
        setProfile(config.profile)
        setPermissions(config.permissions)
        setGroups(config.groups)
      })
      .catch((error) => console.error("Fehler beim Laden der Rechte:", error))
    return () => {
      cancelled = true
    }
  }, [user])

  const handleSave = async () => {
    if (!user) return
    setIsSaving(true)
    try {
      await saveUserAccessConfig({ userId: user.id, profile, permissions })
      onSaved?.()
      onClose()
    } catch (error) {
      console.error("Fehler beim Speichern der Rechte:", error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[99vw] !max-w-[1400px] sm:!max-w-[1400px] max-h-[92vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Rechte & Zugriffe</DialogTitle>
          <DialogDescription>
            Definiere Themenrechte und Einzelberechtigungen für <strong>{user?.name}</strong> direkt im Tool.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 overflow-y-auto px-6 pb-6">
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              <Label>Zugriffsprofil</Label>
              <Select
                value={profile}
                onValueChange={(value) => {
                  const next = value as AccessProfile
                  setProfile(next)
                  setPermissions({ ...buildPermissionMap(next) })
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Mitarbeiter</SelectItem>
                  <SelectItem value="reporter">Reporter / Lesend</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {profile === "admin"
                  ? "Admin hat immer vollen Zugriff auf alle Bereiche — ohne Einzelschalter."
                  : "Das Profil setzt die Basis. Die Schalter darunter erlauben die Feineinstellung pro Thema (Zeiterfassung, Urlaub, …)."}
              </p>
            </div>

            <Card className="border-border/70 bg-muted/30">
              <CardContent className="p-4">
                <p className="text-sm font-medium">Hinweis</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Rechte werden nur in dieser Anwendung gespeichert (Datenbank), nicht über Microsoft-Gruppen
                  gesteuert.
                </p>
              </CardContent>
            </Card>
          </div>

          {profile === "admin" ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-sm font-medium">Vollzugriff (Admin)</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Dieses Profil umfasst Zeiterfassung, Urlaub und Verwaltung ohne weitere Aufteilung.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue={groups[0]?.key || "admin"} className="gap-4">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                {groups.map((group) => (
                  <TabsTrigger key={group.key} value={group.key}>
                    {group.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {groups.map((group) => (
                <TabsContent key={group.key} value={group.key}>
                  <div className="rounded-xl border border-border/70 bg-card/90">
                    <div className="border-b border-border/70 px-4 py-3">
                      <p className="font-medium">{group.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
                    </div>
                    <div className="divide-y divide-border/70">
                      {group.permissions.map((permission) => (
                        <div key={permission.key} className="flex items-start justify-between gap-4 px-4 py-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{permission.label}</p>
                            <p className="text-xs text-muted-foreground">{permission.description}</p>
                          </div>
                          <Switch
                            checked={!!permissions[permission.key]}
                            onCheckedChange={(checked) =>
                              setPermissions((prev) => ({ ...prev, [permission.key]: checked }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}

          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border/70 bg-background/95 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Schließen
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Speichere..." : "Rechte speichern"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
