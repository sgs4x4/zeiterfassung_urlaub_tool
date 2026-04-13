import { redirect } from "next/navigation"
import { getServerSession } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard-header"
import { VacationDashboard } from "@/components/vacation/vacation-dashboard"
import { getUserByEmail } from "@/lib/db"
import { BUNDESLAENDER, type Bundesland } from "@/lib/holidays"
import { getCurrentUserAccess } from "@/lib/permissions-server"
import { getLegacyHeaderFlags } from "@/lib/permissions"

export default async function VacationPage() {
  const session = await getServerSession()
  const access = await getCurrentUserAccess()

  if (!session?.user?.email) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/urlaub")}`)
  }

  const dbUser = await getUserByEmail(session.user.email)
  const normalizedBundesland = (dbUser?.bundesland || "BY").toUpperCase()
  const userBundesland: Bundesland = normalizedBundesland in BUNDESLAENDER
    ? (normalizedBundesland as Bundesland)
    : "BY"

  if (!access.canAccessVacationModule) {
    redirect("/dashboard")
  }

  const headerFlags = getLegacyHeaderFlags(access.profile, access.permissions)

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        user={session.user}
        {...headerFlags}
      />
      <VacationDashboard
        isAdmin={access.canManageVacationRequests || access.canManageBlockedDays}
        bundesland={userBundesland}
      />
    </div>
  )
}
