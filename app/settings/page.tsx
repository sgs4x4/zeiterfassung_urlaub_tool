import { redirect } from "next/navigation"
import { getServerSession } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard-header"
import { getCurrentUserAccess } from "@/lib/permissions-server"
import { getLegacyHeaderFlags } from "@/lib/permissions"
import { getMyNotificationSettings } from "@/app/actions/user-settings"
import { NotificationSettingsCard } from "@/components/settings/notification-settings-card"

export default async function SettingsPage() {
  const session = await getServerSession()
  const access = await getCurrentUserAccess()

  if (!session?.user?.email) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/settings")}`)
  }

  const headerFlags = getLegacyHeaderFlags(access.profile, access.permissions)
  const settings = await getMyNotificationSettings()

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={session.user} {...headerFlags} />
      <main className="container mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Persoenliche Einstellungen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lege fest, welche E-Mails du vom System erhalten moechtest.
          </p>
        </div>
        <NotificationSettingsCard initialSettings={settings} />
      </main>
    </div>
  )
}
