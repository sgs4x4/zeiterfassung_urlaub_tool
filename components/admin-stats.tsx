"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Clock, Calendar, TrendingUp } from "lucide-react"
import { getAdminDashboardData } from "@/app/actions/admin"
import { format, startOfMonth, endOfMonth } from "date-fns"

export function AdminStats() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalHours: 0,
    totalEntries: 0,
    avgHoursPerUser: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const now = new Date()
        const startDate = format(startOfMonth(now), "yyyy-MM-dd")
        const endDate = format(endOfMonth(now), "yyyy-MM-dd")

        const data = await getAdminDashboardData(startDate, endDate)
        setStats({
          totalUsers: data.users.length,
          totalHours: data.totalHours,
          totalEntries: data.totalEntries,
          avgHoursPerUser: data.users.length > 0 ? data.totalHours / data.users.length : 0,
        })
      } catch (error) {
        console.error("Fehler beim Laden:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadStats()
  }, [])

  const statCards = [
    {
      title: "Mitarbeiter",
      value: stats.totalUsers.toString(),
      icon: Users,
      description: "Registrierte Benutzer",
    },
    {
      title: "Gesamtstunden",
      value: `${stats.totalHours.toFixed(2)}h`,
      icon: Clock,
      description: "Diesen Monat",
    },
    {
      title: "Einträge",
      value: stats.totalEntries.toString(),
      icon: Calendar,
      description: "Zeiteinträge gesamt",
    },
    {
      title: "Durchschnitt",
      value: `${stats.avgHoursPerUser.toFixed(2)}h`,
      icon: TrendingUp,
      description: "Pro Mitarbeiter",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => (
        <Card key={stat.title} className="border-border/70 bg-card/90 py-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 animate-pulse rounded-md bg-muted" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
