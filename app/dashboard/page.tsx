import { redirect } from "next/navigation"
import { getServerSession } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard-header"
import { DayEntryForm } from "@/components/day-entry-form"
import { TimeEntries } from "@/components/time-entries"
import { WeekOverview } from "@/components/week-overview"
import { MonthOverview } from "@/components/month-overview"
import { OvertimeBadge } from "@/components/overtime-badge"
import { findOrCreateUser } from "@/lib/db"
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
          <MetricCard label="Wochenziel" value={`${weeklyHours}h`} icon={Clock3} />
          <MetricCard label="Monatsziel" value={`${monthlyHours}h`} icon={CalendarDays} />
          <MetricCard label="Module" value={canUseVacation ? "Zeit + Urlaub" : "Zeit"} icon={ShieldCheck} />
        </MetricGrid>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <DayEntryForm isAdmin={access.canManageAllTimeEntries} />
            <TimeEntries />
          </div>
          <div className="space-y-6">
            <OvertimeBadge />
            <WeekOverview weeklyHours={weeklyHours} />
          </div>
        </div>

        <MonthOverview bundesland={dbUser?.bundesland || "BY"} monthlyHours={monthlyHours} />
      </AppShell>
    </div>
  )
}
