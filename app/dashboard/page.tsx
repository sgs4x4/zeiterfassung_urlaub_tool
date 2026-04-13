import { redirect } from "next/navigation"
import { getServerSession } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard-header"
import { DayEntryForm } from "@/components/day-entry-form"
import { TimeEntries } from "@/components/time-entries"
import { WeekOverview } from "@/components/week-overview"
import { MonthOverview } from "@/components/month-overview"
import { OvertimeBadge } from "@/components/overtime-badge"
import { Card, CardContent } from "@/components/ui/card"
import { findOrCreateUser, type WeeklySchedule } from "@/lib/db"
import { formatHours } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { AppShell, MetricCard, MetricGrid, PageHero } from "@/components/layout/app-shell"
import { CalendarDays, Clock3, ShieldCheck } from "lucide-react"
import { getCurrentUserAccess } from "@/lib/permissions-server"
import { getLegacyHeaderFlags } from "@/lib/permissions"

export default async function DashboardPage() {
  const session = await getServerSession()
  const access = await getCurrentUserAccess()

  if (!session?.user?.email) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/dashboard")}`)
  }

  const userId = session.user.id || session.user.email
  const userName = session.user.name || session.user.email.split("@")[0]

  let dbUser = null
  let dbError = null

  try {
    dbUser = await findOrCreateUser(userId, session.user.email, userName)
  } catch (error) {
    console.log("[v0] Database error:", error)
    dbError = error instanceof Error ? error.message : "Datenbankfehler"
  }

  if (dbError || !dbUser) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader user={{ ...session.user, name: userName }} {...getLegacyHeaderFlags(access.profile, access.permissions)} />
        <main className="container mx-auto p-6 max-w-6xl">
          <div className="bg-destructive/10 border border-destructive rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-destructive">Datenbank-Setup erforderlich</h2>
            <p className="text-muted-foreground">
              Die Datenbanktabellen wurden noch nicht erstellt. Bitte führe das SQL-Script aus:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Öffne die Datei <code className="bg-muted px-1 rounded">scripts/001_create_tables.sql</code>
              </li>
              <li>Klicke auf "Run" um das Script auszuführen</li>
              <li>Lade diese Seite neu</li>
            </ol>
            {dbError && <p className="text-xs text-destructive/80 font-mono mt-4">Fehler: {dbError}</p>}
          </div>
        </main>
      </div>
    )
  }

  const { isAdmin, isReporter, canUseVacation, isVacationAdmin } = getLegacyHeaderFlags(access.profile, access.permissions)
  const monthlyHours    = dbUser.monthly_hours || 173
  const weeklyHours     = dbUser.weekly_hours || 40
  const weeklySchedule  = dbUser.weekly_schedule || {
    monday: 8,
    tuesday: 8,
    wednesday: 8,
    thursday: 8,
    friday: 8,
    saturday: 0,
    sunday: 0,
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={{ ...session.user, name: userName }} isAdmin={isAdmin} isReporter={isReporter} canUseVacation={canUseVacation} isVacationAdmin={isVacationAdmin} />
      <AppShell className="max-w-6xl">
        <PageHero
          title={`Willkommen, ${userName.split(" ")[0]}`}
          description="Erfasse Zeiten, überprüfe Auslastung und halte den Monat sauber im Blick."
          badges={
            <>
              <Badge variant="secondary" className="font-medium">Team Workspace</Badge>
              {isAdmin && <Badge className="font-medium"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Admin</Badge>}
            </>
          }
        />

        <MetricGrid>
          <Card className="border-border/70 bg-card/90 py-4">
            <CardContent className="flex items-start justify-between gap-4 px-5">
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ziele</p>
                <div className="grid gap-3">
                  <div>
                    <p className="text-2xl font-semibold">{formatHours(weeklyHours)}</p>
                    <p className="text-xs text-muted-foreground">Wochenziel</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{formatHours(monthlyHours)}</p>
                    <p className="text-xs text-muted-foreground">Monatsziel</p>
                  </div>
                </div>
              </div>
              <Clock3 className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
          <OvertimeBadge />
          <Card className="border-border/70 bg-card/90 py-4">
            <CardContent className="px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sollplan</p>
                  <p className="mt-1 text-2xl font-semibold">Woche</p>
                </div>
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] leading-tight">
                {([
                  ["monday", "Mo"],
                  ["tuesday", "Di"],
                  ["wednesday", "Mi"],
                  ["thursday", "Do"],
                  ["friday", "Fr"],
                  ["saturday", "Sa"],
                  ["sunday", "So"],
                ] as const).map(([dayKey, label]) => (
                  <div key={dayKey} className="rounded-xl bg-muted/50 py-2 px-1.5">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
                    <div className="mt-1 text-xs font-semibold text-foreground">{formatHours(weeklySchedule[dayKey as keyof WeeklySchedule] ?? 0)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </MetricGrid>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <DayEntryForm isAdmin={access.canManageAllTimeEntries} />
            <TimeEntries />
          </div>
          <div className="space-y-6">
            <WeekOverview weeklyHours={weeklyHours} weeklySchedule={weeklySchedule} />
          </div>
        </div>

        <MonthOverview bundesland={dbUser?.bundesland || "BY"} monthlyHours={monthlyHours} />
      </AppShell>
    </div>
  )
}
