"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeftRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { setDashboardView } from "@/app/actions/dashboard-view"
import type { DashboardView } from "@/lib/dashboard-view"

/**
 * Umschalter zwischen neuer und klassischer Ansicht. Kommt zweimal vor: als Abzeichen
 * neben der Dashboard-Überschrift und als Eintrag im Nutzermenü im Header.
 */
export function ViewSwitch({ view, className }: { view: DashboardView; className?: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const target: DashboardView = view === "beta" ? "classic" : "beta"

  const toggle = () => {
    startTransition(async () => {
      await setDashboardView(target)
      router.refresh()
      toast.success(target === "beta" ? "Neue Ansicht aktiviert" : "Klassische Ansicht aktiviert")
    })
  }

  if (view === "beta") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        title="Zur klassischen Ansicht wechseln"
        className={cn(
          "group inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 py-1 pr-2.5 pl-3 text-xs font-semibold tracking-wide text-primary transition-colors",
          "hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60",
          className,
        )}
      >
        BETA
        <span className="flex items-center gap-1 border-l border-primary/25 pl-2 font-medium opacity-80">
          <ArrowLeftRight className="h-3 w-3" />
          <span className="hidden sm:inline">alte Ansicht</span>
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      title="Zur neuen Ansicht wechseln"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors",
        "hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60",
        className,
      )}
    >
      <ArrowLeftRight className="h-3 w-3" />
      Neue Ansicht testen
      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">BETA</span>
    </button>
  )
}
