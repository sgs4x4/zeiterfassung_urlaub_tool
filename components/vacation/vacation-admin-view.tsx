"use client"

import { useEffect, useState, useCallback } from "react"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CheckCircle, XCircle, Clock, Trash2, Users, Search } from "lucide-react"
import { getAllAbsences, updateAbsenceStatus, deleteAbsence, type Absence } from "@/app/actions/absences"
import { cn } from "@/lib/utils"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"

const TYPE_LABELS: Record<string, string> = { vacation: "Urlaub", sick: "Krankheit", other: "Sonstiges" }
const TYPE_COLORS: Record<string, string> = { vacation: "bg-blue-500", sick: "bg-red-400", other: "bg-amber-400" }
const STATUS_CONFIG = {
  pending:  { label: "Ausstehend", badge: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400" },
  approved: { label: "Genehmigt",  badge: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400" },
  rejected: { label: "Abgelehnt",  badge: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400" },
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

export function VacationAdminView() {
  const searchParams = useSearchParams()
  const [absences, setAbsences] = useState<Absence[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"pending" | "all">("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [highlightedAbsenceId, setHighlightedAbsenceId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAllAbsences()
      setAbsences(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const linkedAbsenceId = searchParams.get("absenceId")
    if (!linkedAbsenceId) return
    setFilter("all")
    setHighlightedAbsenceId(linkedAbsenceId)
  }, [searchParams])

  useEffect(() => {
    if (!highlightedAbsenceId || loading) return
    const el = document.getElementById(`absence-${highlightedAbsenceId}`)
    if (!el) return

    el.scrollIntoView({ behavior: "smooth", block: "center" })
    const timeout = window.setTimeout(() => setHighlightedAbsenceId(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [highlightedAbsenceId, loading, absences, filter])

  const handleApprove = async (id: string) => { await updateAbsenceStatus(id, "approved"); load() }
  const handleReject  = async (id: string) => { await updateAbsenceStatus(id, "rejected"); load() }
  const handleDelete  = async (id: string) => { if (!confirm("Antrag löschen?")) return; await deleteAbsence(id); load() }

  const pending  = absences.filter((a) => a.status === "pending")
  const approved = absences.filter((a) => a.status === "approved")
  const rejected = absences.filter((a) => a.status === "rejected")
  const scopedAbsences = filter === "pending" ? pending : absences
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const displayed = scopedAbsences.filter((absence) => {
    if (!normalizedSearch) return true
    return (
      (absence.user?.name || "").toLowerCase().includes(normalizedSearch) ||
      (absence.user?.email || "").toLowerCase().includes(normalizedSearch) ||
      (absence.reason || "").toLowerCase().includes(normalizedSearch)
    )
  })

  return (
    <main className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alle Anträge</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Abwesenheitsanträge aller Mitarbeiter genehmigen oder ablehnen</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
          >
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            Ausstehend
            {pending.length > 0 && (
              <Badge className="ml-1.5 bg-white/20 text-white border-0 text-[10px] h-4 px-1">{pending.length}</Badge>
            )}
          </Button>
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Alle ({absences.length})
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/70 bg-card/90">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Ausstehend</p>
            <p className="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400">{pending.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/90">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Genehmigt</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{approved.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/90">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Abgelehnt</p>
            <p className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">{rejected.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/90">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              placeholder="Nach Name, E-Mail oder Begründung suchen"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {displayed.length} von {scopedAbsences.length} Anträgen sichtbar
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">Lade Anträge...</div>
      ) : displayed.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-emerald-500/30 mb-3" />
            <p className="font-medium text-muted-foreground">
              {filter === "pending" ? "Keine ausstehenden Anträge" : "Noch keine Anträge vorhanden"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {displayed.map((absence) => {
            const statusCfg = STATUS_CONFIG[absence.status] || STATUS_CONFIG.pending
            return (
              <Card
                key={absence.id}
                id={`absence-${absence.id}`}
                className={cn(
                  "overflow-hidden",
                  highlightedAbsenceId === absence.id && "ring-2 ring-primary/50"
                )}
              >
                <CardContent className="p-0">
                  <div className="flex items-center gap-4 p-4 flex-wrap">
                    <div className={cn("w-1 self-stretch rounded-full shrink-0 min-h-[48px]", TYPE_COLORS[absence.type])} />

                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {getInitials(absence.user?.name || "?")}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{absence.user?.name || "Unbekannt"}</span>
                        <span className="text-muted-foreground text-xs">{absence.user?.email}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-sm">{TYPE_LABELS[absence.type]}</span>
                        <Badge variant="outline" className={cn("text-xs border", statusCfg.badge)}>
                          {absence.status === "approved" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {absence.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                          {absence.status === "pending"  && <Clock className="h-3 w-3 mr-1" />}
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {format(new Date(absence.start_date), "dd. MMMM yyyy", { locale: de })}
                        {" – "}
                        {format(new Date(absence.end_date), "dd. MMMM yyyy", { locale: de })}
                        <span className="ml-2 font-medium text-foreground">{absence.days} Arbeitstage</span>
                      </p>
                      {absence.reason && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">&ldquo;{absence.reason}&rdquo;</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {absence.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/20 dark:border-red-900"
                            onClick={() => handleReject(absence.id)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Ablehnen
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleApprove(absence.id)}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Genehmigen
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(absence.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </main>
  )
}
