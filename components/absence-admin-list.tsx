"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CheckCircle, XCircle, Clock, CalendarOff } from "lucide-react"
import { getAllAbsences, updateAbsenceStatus, type Absence } from "@/app/actions/absences"
import { format } from "date-fns"
import { de } from "date-fns/locale"

interface AbsenceWithUser extends Absence {
  user: { name: string; email: string }
}

const TYPE_LABELS: Record<string, string> = {
  vacation: "Urlaub",
  sick: "Krankheit",
  other: "Sonstiges",
}

const STATUS_CONFIG = {
  pending: { label: "Ausstehend", className: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20" },
  approved: { label: "Genehmigt", className: "bg-green-500/10 text-green-700 border-green-500/20" },
  rejected: { label: "Abgelehnt", className: "bg-red-500/10 text-red-700 border-red-500/20" },
}

export function AbsenceAdminList() {
  const [absences, setAbsences] = useState<AbsenceWithUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "pending">("pending")

  const load = async () => {
    try {
      const data = await getAllAbsences()
      setAbsences(data as AbsenceWithUser[])
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleStatus = async (id: string, status: "approved" | "rejected") => {
    await updateAbsenceStatus(id, status)
    load()
  }

  const displayed = filter === "pending"
    ? absences.filter((a) => a.status === "pending")
    : absences

  const pendingCount = absences.filter((a) => a.status === "pending").length

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-primary" />
            Abwesenheitsanträge
            {pendingCount > 0 && (
              <Badge className="bg-yellow-500 text-white border-0 text-xs">{pendingCount}</Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={filter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("pending")}
            >
              Ausstehend
              {pendingCount > 0 && <span className="ml-1.5 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
            </Button>
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              Alle
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Lade...</div>
        ) : displayed.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {filter === "pending" ? "Keine ausstehenden Anträge" : "Keine Abwesenheiten vorhanden"}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((absence) => {
              const statusCfg = STATUS_CONFIG[absence.status] || STATUS_CONFIG.pending
              return (
                <div key={absence.id} className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors flex-wrap">
                  {/* User */}
                  <div className="flex items-center gap-3 min-w-[160px] flex-1">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {getInitials(absence.user?.name || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm leading-tight">{absence.user?.name}</p>
                      <p className="text-xs text-muted-foreground">{absence.user?.email}</p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{TYPE_LABELS[absence.type] || absence.type}</span>
                      <Badge variant="outline" className={`text-xs ${statusCfg.className}`}>
                        {absence.status === "approved" && <CheckCircle className="h-3 w-3 mr-1" />}
                        {absence.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                        {absence.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                        {statusCfg.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {format(new Date(absence.start_date), "dd.MM.yyyy", { locale: de })} –{" "}
                      {format(new Date(absence.end_date), "dd.MM.yyyy", { locale: de })}
                      <span className="ml-2 font-medium">{absence.days} Arbeitstage</span>
                    </p>
                    {absence.reason && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{absence.reason}</p>
                    )}
                  </div>

                  {/* Actions */}
                  {absence.status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/20"
                        onClick={() => handleStatus(absence.id, "rejected")}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Ablehnen
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleStatus(absence.id, "approved")}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Genehmigen
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
