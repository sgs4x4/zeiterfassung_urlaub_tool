"use client"

import { useEffect, useState, type ReactNode } from "react"
import { ShieldCheck } from "lucide-react"
import { formatHours } from "@/lib/utils"
import type { WeeklySchedule } from "@/lib/db"

const WEEKDAY_INDEX_TO_KEY = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
} as const

interface GreetingHeroProps {
  firstName: string
  weeklySchedule: WeeklySchedule
  isAdmin?: boolean
  /** BETA-Abzeichen, das zugleich zur klassischen Ansicht umschaltet. */
  viewSwitch?: ReactNode
}

/**
 * Ruhiger, personalisierter Seitenkopf. Bewusst ohne eigene Datenabfrage – die
 * Kennzahlen stehen in den Karten und im Board darunter, hier zählt nur Kontext.
 */
export function GreetingHero({ firstName, weeklySchedule, isAdmin, viewSwitch }: GreetingHeroProps) {
  // Tageszeit erst nach dem Mount auswerten: der Server kennt die lokale Uhrzeit des
  // Browsers nicht, ein direkt gerenderter Gruß würde beim Hydrieren abweichen.
  const [greeting, setGreeting] = useState("Willkommen zurück")

  useEffect(() => {
    const hour = new Date().getHours()
    setGreeting(hour < 12 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend")
  }, [])

  const now = new Date()
  const todayKey = WEEKDAY_INDEX_TO_KEY[now.getDay() as keyof typeof WEEKDAY_INDEX_TO_KEY]
  const todayTarget = weeklySchedule[todayKey] ?? 0

  return (
    <section className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" suppressHydrationWarning>
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {todayTarget > 0
            ? `Heute stehen ${formatHours(todayTarget)} auf dem Plan.`
            : "Heute ist kein Arbeitstag eingeplant."}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {isAdmin && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Admin
          </span>
        )}
        {viewSwitch}
      </div>
    </section>
  )
}
