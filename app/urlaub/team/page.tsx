import { redirect } from "next/navigation"
import { getServerSession } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard-header"
import { VacationCalendarView } from "@/components/vacation/vacation-calendar-view"
import { getCurrentUserAccess } from "@/lib/permissions-server"
import { getLegacyHeaderFlags } from "@/lib/permissions"

export default async function TeamCalendarPage() {
  const session = await getServerSession()
  const access = await getCurrentUserAccess()

  if (!session?.user?.email) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/urlaub/team")}`)
  }

  if (!access.canViewTeamCalendar) {
    redirect("/dashboard")
  }

  const headerFlags = getLegacyHeaderFlags(access.profile, access.permissions)

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        user={session.user}
        {...headerFlags}
      />
      <VacationCalendarView isAdmin={false} showAllAbsences={true} />
    </div>
  )
}
