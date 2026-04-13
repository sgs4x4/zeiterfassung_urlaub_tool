"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Trash2, CheckCircle, XCircle, Clock } from "lucide-react"
import { getMyAbsences, deleteAbsence, getVacationBalance, type Absence } from "@/app/actions/absences"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import { useRouter } from "next/navigation"

export function AbsenceList() {
  const router = useRouter()
  const [absences, setAbsences] = useState<Absence[]>([])
  const [balance, setBalance] = useState({ total: 0, used: 0, pending: 0, available: 0 })
  const [isLoading, setIsLoading] = useState(true)

  const loadData = async () => {
    const [absencesData, balanceData] = await Promise.all([getMyAbsences(), getVacationBalance()])
    setAbsences(absencesData)
    setBalance(balanceData)
    setIsLoading(false)
  }

  useEffect(() => {
    loadData()

    const interval = setInterval(() => {
      if (!document.hidden) {
        loadData()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm("Abwesenheit wirklich löschen?")) return
    await deleteAbsence(id)
    loadData()
    router.refresh()
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "vacation":
        return "Urlaub"
      case "sick":
        return "Krankheit"
      default:
        return "Sonstiges"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "approved":
        return "Genehmigt"
      case "rejected":
        return "Abgelehnt"
      default:
        return "Ausstehend"
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Lade...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Urlaubskontingent {new Date().getFullYear()}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gesamt</span>
            <span className="font-medium">{balance.total} Tage</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Genommen</span>
            <span className="font-medium">{balance.used} Tage</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Beantragt</span>
            <span className="font-medium">{balance.pending} Tage</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t">
            <span className="font-medium">Verfügbar</span>
            <span className="font-bold text-primary">{balance.available} Tage</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Meine Abwesenheiten
          </CardTitle>
        </CardHeader>
        <CardContent>
          {absences.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Noch keine Abwesenheiten</div>
          ) : (
            <div className="space-y-3">
              {absences.map((absence) => (
                (() => {
                  const todayStr = format(new Date(), "yyyy-MM-dd")
                  const canDelete = absence.type === "vacation" ? absence.start_date > todayStr : absence.status === "pending"
                  return (
                <div key={absence.id} className="flex items-start justify-between p-4 rounded-lg border">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{getTypeLabel(absence.type)}</span>
                      <Badge variant="outline" className="text-xs">
                        {getStatusIcon(absence.status)}
                        <span className="ml-1">{getStatusLabel(absence.status)}</span>
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(absence.start_date), "PPP", { locale: de })} -{" "}
                      {format(new Date(absence.end_date), "PPP", { locale: de })}
                    </p>
                    <p className="text-xs text-muted-foreground">{absence.days} Arbeitstage</p>
                    {absence.day_part && absence.day_part !== "full" && (
                      <p className="text-xs text-muted-foreground">
                        {absence.day_part === "half_am" ? "Halbtag (Vormittag)" : "Halbtag (Nachmittag)"}
                      </p>
                    )}
                    {absence.reason && <p className="text-sm">{absence.reason}</p>}
                  </div>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(absence.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                  )
                })()
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
