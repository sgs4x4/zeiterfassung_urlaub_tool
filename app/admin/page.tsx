import { redirect } from "next/navigation"
import { getServerSession } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard-header"
import { AdminUserList } from "../../components/admin-user-list"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FolderKanban, ShieldCheck, CalendarDays, Users2, ClipboardList, ArrowRight, Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUserAccess } from "@/lib/permissions-server"
import { getLegacyHeaderFlags } from "@/lib/permissions"

export default async function AdminPage() {
  const session = (await getServerSession()) as any
  const access = await getCurrentUserAccess()

  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/admin")}`)
  }

  const { isAdmin, isReporter, canUseVacation, isVacationAdmin } = getLegacyHeaderFlags(access.profile, access.permissions)

  if (!access.canAccessAdmin) {
    redirect("/dashboard")
  }

  const canManageAnySection =
    access.canManagePermissions ||
    access.canManageUsers ||
    access.canAssignProjects ||
    access.canManageAllTimeEntries ||
    access.canManageProjects ||
    access.canManageVacationRequests ||
    access.canManageBlockedDays
  const adminModeLabel = canManageAnySection ? "Schreibzugriff" : "Read-only Zugriff"

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        user={session.user}
        isAdmin={isAdmin}
        isReporter={isReporter}
        canUseVacation={canUseVacation}
        isVacationAdmin={isVacationAdmin}
      />
      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-medium">People Operations</Badge>
              {isAdmin && (
                <Badge className="font-medium">
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  Admin
                </Badge>
              )}
              {!isAdmin && (
                <Badge variant="outline" className="font-medium">
                  <Eye className="mr-1 h-3.5 w-3.5" />
                  Reporter
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {isAdmin ? "Admin Hub" : "Übersicht"}
            </h1>
            <p className="text-muted-foreground">
              Zentrale Userverwaltung mit verlinkten Fachbereichen für Zeiterfassung und Urlaubsplanung.
            </p>
          </div>
          <Badge variant="outline" className="h-7 px-2.5 text-xs font-medium">
            {adminModeLabel}
          </Badge>
        </div>



        <section id="userverwaltung" className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Userverwaltung</h2>
          <p className="text-sm text-muted-foreground">
            {canManageAnySection
              ? "Zentrale Verwaltung von Mitarbeitern, Rechten und fachlichen Bereichen."
              : "Read-only Übersicht über Mitarbeiterdaten und Zeitkonten."}
          </p>
          <AdminUserList
            canManageUserProfile={access.canManageUsers}
            canAssignProjects={access.canAssignProjects}
            canManagePermissions={access.canManagePermissions}
            canViewEntries={access.canViewOthersTimeData}
            canEditEntries={access.canManageOthersTimeData}
          />
        </section>
      </main>
    </div>
  )
}
