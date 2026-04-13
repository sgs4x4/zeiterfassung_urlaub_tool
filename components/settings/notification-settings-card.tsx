"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { updateMyNotificationSettings } from "@/app/actions/user-settings"

type InitialSettings = {
  notifyVacationPending: boolean
  notifyVacationApproved: boolean
  notifyVacationRejected: boolean
  notifyVacationWithdrawn: boolean
}

export function NotificationSettingsCard({ initialSettings }: { initialSettings: InitialSettings }) {
  const [notifyVacationPending, setNotifyVacationPending] = useState(initialSettings.notifyVacationPending)
  const [notifyVacationApproved, setNotifyVacationApproved] = useState(initialSettings.notifyVacationApproved)
  const [notifyVacationRejected, setNotifyVacationRejected] = useState(initialSettings.notifyVacationRejected)
  const [notifyVacationWithdrawn, setNotifyVacationWithdrawn] = useState(initialSettings.notifyVacationWithdrawn)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const onSave = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      await updateMyNotificationSettings({
        notifyVacationPending,
        notifyVacationApproved,
        notifyVacationRejected,
        notifyVacationWithdrawn,
      })
      setMessage("Einstellungen gespeichert.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Fehler beim Speichern.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader>
        <CardTitle>Benachrichtigungen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/70 p-4">
          <div className="space-y-1">
            <Label htmlFor="notify-vacation-status" className="text-sm font-medium">
              Neue Urlaubsantrage (pending)
            </Label>
            <p className="text-xs text-muted-foreground">
              Erhalte E-Mails, wenn ein neuer Urlaubsantrag eingeht.
            </p>
          </div>
          <Switch
            id="notify-vacation-status"
            checked={notifyVacationPending}
            onCheckedChange={setNotifyVacationPending}
          />
        </div>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/70 p-4">
          <div className="space-y-1">
            <Label htmlFor="notify-vacation-approved" className="text-sm font-medium">
              Status: Genehmigt
            </Label>
            <p className="text-xs text-muted-foreground">Erhalte E-Mails zu genehmigten Antragen.</p>
          </div>
          <Switch
            id="notify-vacation-approved"
            checked={notifyVacationApproved}
            onCheckedChange={setNotifyVacationApproved}
          />
        </div>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/70 p-4">
          <div className="space-y-1">
            <Label htmlFor="notify-vacation-rejected" className="text-sm font-medium">
              Status: Abgelehnt
            </Label>
            <p className="text-xs text-muted-foreground">Erhalte E-Mails zu abgelehnten Antragen.</p>
          </div>
          <Switch
            id="notify-vacation-rejected"
            checked={notifyVacationRejected}
            onCheckedChange={setNotifyVacationRejected}
          />
        </div>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/70 p-4">
          <div className="space-y-1">
            <Label htmlFor="notify-vacation-withdrawn" className="text-sm font-medium">
              Status: Zuruckgenommen
            </Label>
            <p className="text-xs text-muted-foreground">
              Erhalte E-Mails, wenn Antrage zuruckgezogen werden (auch als Admin separat steuerbar).
            </p>
          </div>
          <Switch
            id="notify-vacation-withdrawn"
            checked={notifyVacationWithdrawn}
            onCheckedChange={setNotifyVacationWithdrawn}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          {message && <p className="text-xs text-muted-foreground">{message}</p>}
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? "Speichert..." : "Speichern"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
