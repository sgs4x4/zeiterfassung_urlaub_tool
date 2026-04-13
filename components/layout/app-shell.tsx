import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

interface AppShellProps {
  children: ReactNode
  className?: string
}

interface PageHeroProps {
  title: string
  description: string
  badges?: ReactNode
  actions?: ReactNode
}

interface MetricCardProps {
  label: string
  value: string
  icon: LucideIcon
  className?: string
}

export function AppShell({ children, className }: AppShellProps) {
  return <main className={cn("container mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6 md:py-8", className)}>{children}</main>
}

export function PageHero({ title, description, badges, actions }: PageHeroProps) {
  return (
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2">
        {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </section>
  )
}

export function MetricGrid({ children, className }: AppShellProps) {
  return <section className={cn("grid gap-4 md:grid-cols-3", className)}>{children}</section>
}

export function MetricCard({ label, value, icon: Icon, className }: MetricCardProps) {
  return (
    <Card className={cn("border-border/70 bg-card/90 py-4", className)}>
      <CardContent className="flex items-center justify-between px-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </CardContent>
    </Card>
  )
}