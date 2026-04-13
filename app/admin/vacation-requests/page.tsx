import { redirect } from "next/navigation"
import { getServerSession } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard-header"
import { VacationAdminView } from "@/components/vacation/vacation-admin-view"
import { getCurrentUserAccess } from "@/lib/permissions-server"
import { getLegacyHeaderFlags } from "@/lib/permissions"

export default async function AdminVacationRequestsPage() {
  const session = await getServerSession()
  const access = await getCurrentUserAccess()

  if (!session?.user?.email) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/admin/vacation-requests")}`)
  }

  if (!access.canAccessAdmin || !access.canManageVacationRequests) {
    redirect("/admin")
  }

  const headerFlags = getLegacyHeaderFlags(access.profile, access.permissions)

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        user={session.user}
        {...headerFlags}
      />
      <VacationAdminView />
    </div>
  )
}
