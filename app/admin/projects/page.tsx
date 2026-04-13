import { getAllProjects } from "@/app/actions/projects"
import { ProjectManager } from "@/components/project-manager"
import { Card } from "@/components/ui/card"
import { redirect } from "next/navigation"
import { getServerSession } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard-header"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FolderKanban, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getCurrentUserAccess } from "@/lib/permissions-server"
import { getLegacyHeaderFlags } from "@/lib/permissions"

export default async function ProjectsPage() {
  const session = (await getServerSession()) as any
  const access = await getCurrentUserAccess()

  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/admin/projects")}`)
  }

  if (!access.canManageProjects) {
    redirect("/dashboard")
  }

  const headerFlags = getLegacyHeaderFlags(access.profile, access.permissions)

  const projects = await getAllProjects()

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        user={{
          name: session.user?.name,
          email: session.user?.email,
          image: session.user?.image,
        }}
        {...headerFlags}
      />

      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-medium">Zeiterfassung Admin</Badge>
                <Badge className="font-medium">
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  Admin
                </Badge>
              </div>
              <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
                <FolderKanban className="h-7 w-7 text-primary" />
                Projekt-Verwaltung
              </h1>
              <p className="text-muted-foreground">
                Projekte und Zuordnungen für die Zeiterfassung zentral pflegen.
              </p>
            </div>
          </div>
        </div>

        <Card className="border-border/70 bg-card/90 p-6">
          <ProjectManager projects={projects} />
        </Card>
      </main>
    </div>
  )
}
