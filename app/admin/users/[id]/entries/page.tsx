import { getServerSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { UserEntriesView } from "@/components/user-entries-view"
import { DashboardHeader } from "@/components/dashboard-header"
import { getCurrentUserAccess } from "@/lib/permissions-server"
import { getLegacyHeaderFlags } from "@/lib/permissions"
import { getUserById } from "@/lib/db"
import { canActorManageTargetTime, canActorViewTargetTime } from "@/lib/visibility"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function UserEntriesPage({ params }: PageProps) {
  const { id } = await params
  const session = await getServerSession()
  const access = await getCurrentUserAccess()

  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/admin/users/${id}/entries`)}`)
  }

  const actor = access.dbUser
  const target = await getUserById(id)

  if (!actor || !target || !canActorViewTargetTime(actor, target, access)) {
    redirect("/dashboard")
  }

  const headerFlags = getLegacyHeaderFlags(access.profile, access.permissions)

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        user={session.user}
        {...headerFlags}
      />
      <main className="container mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <UserEntriesView
          userId={id}
          canManageEntries={canActorManageTargetTime(actor, target, access)}
          canManageClosures={
            access.canManageMonthClosures && canActorManageTargetTime(actor, target, access)
          }
        />
      </main>
    </div>
  )
}
