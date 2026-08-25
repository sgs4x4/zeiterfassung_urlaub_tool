"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarRange, Pencil, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { dismissBetaNotice, setDashboardView } from "@/app/actions/dashboard-view"

const HIGHLIGHTS = [
  {
    icon: CalendarRange,
    title: "Wochen-Board statt Formular",
    text: "Die ganze Woche auf einen Blick – jeder Tag mit seinen Einträgen, Soll und Fortschritt.",
  },
  {
    icon: Pencil,
    title: "Einträge bearbeiten",
    text: "Klick auf einen Eintrag öffnet ihn zum Ändern oder Löschen – auch rückwirkend in der laufenden Woche.",
  },
  {
    icon: Sparkles,
    title: "Spürbar schneller",
    text: "Weniger Ladezeit beim Öffnen, Änderungen erscheinen sofort.",
  },
]

/**
 * Einmaliger Hinweis auf die neue Ansicht. Wird nur gerendert, wenn der Server
 * feststellt, dass das Hinweis-Cookie noch nicht gesetzt ist.
 */
export function BetaNotice() {
  const [open, setOpen] = useState(true)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const close = () => {
    setOpen(false)
    // Nicht awaiten: der Dialog soll sofort zugehen, das Cookie folgt.
    void dismissBetaNotice()
  }

  const switchToClassic = () => {
    startTransition(async () => {
      await setDashboardView("classic")
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-primary">
              BETA
            </span>
          </div>
          <DialogTitle className="text-xl">Das Dashboard ist neu</DialogTitle>
          <DialogDescription>
            Die Zeiterfassung hat eine überarbeitete Oberfläche bekommen. Du kannst jederzeit zur gewohnten Ansicht
            zurückwechseln.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3.5 py-1">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
          Umschalten geht jederzeit über das <strong className="font-medium text-foreground">BETA</strong>-Abzeichen
          oben oder über das Menü hinter deinem Namen.
        </p>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={switchToClassic} disabled={isPending}>
            Alte Ansicht nutzen
          </Button>
          <Button type="button" onClick={close} disabled={isPending}>
            Los geht's
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
