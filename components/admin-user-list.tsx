"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Users, Clock3, CalendarDays, CalendarIcon, ChevronRight, ChevronDown, ClipboardList, Info, Search, MoreHorizontal, ArrowUpDown, BriefcaseBusiness, TimerReset, Tags, Plane, FolderTree, MapPinned, SlidersHorizontal, X, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { getAdminDashboardData } from "@/app/actions/admin"
import { ExportButton } from "@/components/export-button"
import { OvertimeAccountDialog } from "@/components/admin/overtime-account-dialog"
import { EmploymentDialog } from "@/components/admin/employment-dialog"
import { AccessDialog } from "@/components/admin/access-dialog"
import { AbsenceDialog } from "@/components/admin/absence-dialog"
import {
  BundeslandDialog,
  CategoryDialog,
  ProjectsDialog,
  VacationDaysDialog,
} from "@/components/admin/user-field-dialogs"
import { type User, type EmployeeType, type UserCategory, USER_CATEGORY_LABELS } from "@/lib/db"
import { formatHours } from "@/lib/utils"

import { format, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { de } from "date-fns/locale"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"

interface UserWithStats extends User {
  totalHours: number
  entriesCount: number
  usedVacationDays?: number
  pendingVacationDays?: number
  remainingVacationDays?: number
  /** Kumulierter Überstunden-Saldo seit Beginn der Erfassung (unabhängig vom Filterzeitraum). */
  overtimeBalance?: number
}

type AdminUserListProps = {
  canManageUserProfile?: boolean
  canAssignProjects?: boolean
  canManagePermissions?: boolean
  canViewEntries?: boolean
  canEditEntries?: boolean
}

export function AdminUserList({
  canManageUserProfile = false,
  canAssignProjects = false,
  canManagePermissions = false,
  canViewEntries = false,
  canEditEntries = false,
}: AdminUserListProps) {
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [filterStartDate, setFilterStartDate] = useState<Date>(startOfMonth(new Date()))
  const [filterEndDate, setFilterEndDate] = useState<Date>(endOfMonth(new Date()))
  const [searchTerm, setSearchTerm] = useState("")
  const [employeeTypeFilters, setEmployeeTypeFilters] = useState<EmployeeType[]>([])
  const [categoryFilters, setCategoryFilters] = useState<UserCategory[]>([])
  const [sortBy, setSortBy] = useState<"name" | "hours" | "vacation" | "overtime">("name")

  const [editingEmployee, setEditingEmployee] = useState<User | null>(null)

  const [editingBundesland, setEditingBundesland] = useState<User | null>(null)

  const [editingProjects, setEditingProjects] = useState<User | null>(null)

  const [editingCategory, setEditingCategory] = useState<User | null>(null)
  const [editingVacationDays, setEditingVacationDays] = useState<User | null>(null)
  const [overtimeAccountUser, setOvertimeAccountUser] = useState<User | null>(null)
  const [absenceUser, setAbsenceUser] = useState<User | null>(null)
  const [editingAccessUser, setEditingAccessUser] = useState<User | null>(null)

  const canOpenManageMenu = canManageUserProfile || canAssignProjects || canManagePermissions
  const isReadOnly = !canOpenManageMenu

  const loadUsers = async () => {
    try {
      const start = format(filterStartDate, "yyyy-MM-dd")
      const end = format(filterEndDate, "yyyy-MM-dd")
      const data = await getAdminDashboardData(start, end)
      setUsers(data.users)
    } catch (error) {
      console.error("Fehler beim Laden:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [filterStartDate, filterEndDate])












  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()

  const setThisMonth = () => {
    setFilterStartDate(startOfMonth(new Date()))
    setFilterEndDate(endOfMonth(new Date()))
  }

  const setLastMonth = () => {
    const lastMonth = subMonths(new Date(), 1)
    setFilterStartDate(startOfMonth(lastMonth))
    setFilterEndDate(endOfMonth(lastMonth))
  }

  const resetFilters = () => {
    setSearchTerm("")
    setEmployeeTypeFilters([])
    setCategoryFilters([])
    setSortBy("name")
    setThisMonth()
  }

  const toggleEmployeeTypeFilter = (type: EmployeeType) => {
    setEmployeeTypeFilters((prev) =>
      prev.includes(type) ? prev.filter((entry) => entry !== type) : [...prev, type],
    )
  }

  const toggleCategoryFilter = (category: UserCategory) => {
    setCategoryFilters((prev) =>
      prev.includes(category) ? prev.filter((entry) => entry !== category) : [...prev, category],
    )
  }

  const getEmployeeTypeLabel = (type: EmployeeType) => {
    const config: Record<EmployeeType, { label: string; className: string }> = {
      vollzeit: { label: "Vollzeit", className: "bg-primary/10 text-primary border-primary/20" },
      teilzeit: { label: "Teilzeit", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
      minijob: { label: "Minijob", className: "bg-muted text-muted-foreground border-border" },
    }
    return config[type] || config.vollzeit
  }

  const getHoursStatus = (user: UserWithStats) => {
    const target = user.monthly_hours || 173
    const ratio = user.totalHours / target
    if (ratio >= 1) return { color: "text-green-600", label: "Ziel erreicht" }
    if (ratio >= 0.8) return { color: "text-yellow-600", label: "Fast am Ziel" }
    return { color: "text-muted-foreground", label: "In Bearbeitung" }
  }

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    const result = users.filter((user) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch)

      const matchesEmployeeType =
        employeeTypeFilters.length === 0 || employeeTypeFilters.includes((user.employee_type as EmployeeType) || "vollzeit")
      const matchesCategory =
        categoryFilters.length === 0 || categoryFilters.includes((user.category as UserCategory) || "sonstiges")

      return matchesSearch && matchesEmployeeType && matchesCategory
    })

    result.sort((a, b) => {
      if (sortBy === "hours") return b.totalHours - a.totalHours
      if (sortBy === "vacation") return (b.remainingVacationDays || 0) - (a.remainingVacationDays || 0)
      if (sortBy === "overtime") return (a.overtimeBalance ?? 0) - (b.overtimeBalance ?? 0)
      return a.name.localeCompare(b.name, "de")
    })

    return result
  }, [users, searchTerm, employeeTypeFilters, categoryFilters, sortBy])

  const kpiTotalHours = filteredUsers.reduce((sum, u) => sum + u.totalHours, 0)
  const kpiEntries = filteredUsers.reduce((sum, u) => sum + u.entriesCount, 0)
  const kpiAvgHours = filteredUsers.length > 0 ? kpiTotalHours / filteredUsers.length : 0
  const kpiOvertime = filteredUsers.reduce((sum, u) => sum + (u.overtimeBalance ?? 0), 0)

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    employeeTypeFilters.length > 0 ||
    categoryFilters.length > 0 ||
    sortBy !== "name"

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-5 h-24" />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-700 dark:text-blue-300">Zugriffe werden jetzt intern im Tool nach Themen und Einzelrechten gepflegt. Microsoft dient nur noch zur Anmeldung.
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Mitarbeiter ({filteredUsers.length})</h2>
          {filteredUsers.length !== users.length && (
            <Badge variant="secondary" className="text-xs">von {users.length}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={setThisMonth}>Aktueller Monat</Button>
          <Button variant="outline" size="sm" onClick={setLastMonth}>Letzter Monat</Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(filterStartDate, "dd.MM.yy")} – {format(filterEndDate, "dd.MM.yy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
              <div className="space-y-4">
                <div>
                  <Label>Von</Label>
                  <Calendar mode="single" selected={filterStartDate} onSelect={(d) => d && setFilterStartDate(d)} locale={de} />
                </div>
                <div>
                  <Label>Bis</Label>
                  <Calendar mode="single" selected={filterEndDate} onSelect={(d) => d && setFilterEndDate(d)} locale={de} />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Kennzahlen aus den bereits geladenen Daten – bewusst kein zweiter getAdminDashboardData-
          Aufruf, der berechnet inzwischen pro Mitarbeiter den Überstundensaldo. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Mitarbeiter", value: filteredUsers.length.toString(), hint: hasActiveFilters ? `von ${users.length} gesamt` : "im Zugriff", icon: Users },
          { label: "Stunden im Zeitraum", value: formatHours(kpiTotalHours), hint: `${kpiEntries} Einträge`, icon: Clock3 },
          { label: "Ø pro Mitarbeiter", value: formatHours(kpiAvgHours), hint: "im gewählten Zeitraum", icon: ArrowUpDown },
          {
            label: "Überstunden gesamt",
            value: (kpiOvertime > 0 ? "+" : "") + formatHours(kpiOvertime),
            hint: "kumulierter Saldo aller Konten",
            icon: kpiOvertime < 0 ? TrendingDown : TrendingUp,
            tone: kpiOvertime > 0 ? "text-green-600 dark:text-green-400" : kpiOvertime < 0 ? "text-red-600 dark:text-red-400" : "",
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-border/70 bg-card/90 py-4">
            <CardContent className="px-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                <kpi.icon className="h-4 w-4 text-primary" />
              </div>
              <p className={`mt-1 text-2xl font-semibold ${kpi.tone ?? ""}`}>{isLoading ? "…" : kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 bg-card/90">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Filter & Sortierung</p>
                <p className="text-xs text-muted-foreground">Schnellfilter für die tägliche HR-Verwaltung</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as "name" | "hours" | "vacation" | "overtime") }>
                <SelectTrigger className="h-8 w-[230px]">
                  <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sortierung: Name (A–Z)</SelectItem>
                  <SelectItem value="hours">Sortierung: Stunden (absteigend)</SelectItem>
                  <SelectItem value="vacation">Sortierung: Resturlaub (absteigend)</SelectItem>
                  <SelectItem value="overtime">Sortierung: Überstunden (kritischste zuerst)</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 px-2 text-xs">
                  <X className="mr-1 h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
              <ExportButton
                startDate={format(filterStartDate, "yyyy-MM-dd")}
                endDate={format(filterEndDate, "yyyy-MM-dd")}
              />
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-12">
            <div className="md:col-span-6 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Suche</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  placeholder="Name oder E-Mail eingeben"
                />
              </div>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Beschäftigungsart</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="truncate text-left">
                      {employeeTypeFilters.length === 0 ? "Alle Beschäftigungsarten" : `${employeeTypeFilters.length} ausgewählt`}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[260px]">
                  <DropdownMenuLabel>Beschäftigungsarten</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setEmployeeTypeFilters([]) }}>
                    Alle anzeigen
                  </DropdownMenuItem>
                  <DropdownMenuCheckboxItem
                    checked={employeeTypeFilters.includes("vollzeit")}
                    onCheckedChange={() => toggleEmployeeTypeFilter("vollzeit")}
                  >
                    Vollzeit
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={employeeTypeFilters.includes("teilzeit")}
                    onCheckedChange={() => toggleEmployeeTypeFilter("teilzeit")}
                  >
                    Teilzeit
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={employeeTypeFilters.includes("minijob")}
                    onCheckedChange={() => toggleEmployeeTypeFilter("minijob")}
                  >
                    Minijob
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Team</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="truncate text-left">
                      {categoryFilters.length === 0 ? "Alle Teams" : `${categoryFilters.length} ausgewählt`}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[260px]">
                  <DropdownMenuLabel>Teams</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setCategoryFilters([]) }}>
                    Alle anzeigen
                  </DropdownMenuItem>
                  {Object.entries(USER_CATEGORY_LABELS).map(([key, label]) => (
                    <DropdownMenuCheckboxItem
                      key={key}
                      checked={categoryFilters.includes(key as UserCategory)}
                      onCheckedChange={() => toggleCategoryFilter(key as UserCategory)}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/70 px-4 py-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {searchTerm.trim() && <Badge variant="secondary" className="text-[10px]">Suche aktiv</Badge>}
              {employeeTypeFilters.map((type) => (
                <Badge key={type} variant="secondary" className="text-[10px]">{getEmployeeTypeLabel(type).label}</Badge>
              ))}
              {categoryFilters.map((category) => (
                <Badge key={category} variant="secondary" className="text-[10px]">{USER_CATEGORY_LABELS[category]}</Badge>
              ))}
              {!hasActiveFilters && <span className="text-[11px] text-muted-foreground">Keine aktiven Filter</span>}
            </div>
            <span className="text-[11px] text-muted-foreground">{filteredUsers.length} Treffer</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Mitarbeiter</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Beschäftigung</TableHead>
                <TableHead className="text-right">Resturlaub</TableHead>
                <TableHead className="text-right">Genommen</TableHead>
                <TableHead className="text-right">Beantragt</TableHead>
                <TableHead>Stunden im Zeitraum</TableHead>
                <TableHead className="text-right">Überstunden</TableHead>
                <TableHead className="text-right pr-4">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const typeConfig = getEmployeeTypeLabel((user.employee_type as EmployeeType) || "vollzeit")
                const hoursStatus = getHoursStatus(user)
                const target = user.monthly_hours || 173
                const progressPct = Math.min((user.totalHours / target) * 100, 100)
                const yearlyVacation = Number(user.vacation_days_per_year || 30)
                const usedVacationDays = Number(user.usedVacationDays || 0)
                const pendingVacationDays = Number(user.pendingVacationDays || 0)
                const remainingVacationDays = Number(user.remainingVacationDays ?? Math.max(yearlyVacation - usedVacationDays, 0))

                return (
                  <TableRow key={user.id}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3 min-w-[260px]">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold leading-tight">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {user.category ? USER_CATEGORY_LABELS[user.category as UserCategory] : "Keine Zuordnung"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${typeConfig.className}`}>{typeConfig.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        {remainingVacationDays.toFixed(1)} d
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">von {yearlyVacation} d</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-medium">{usedVacationDays.toFixed(1)} d</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-medium">{pendingVacationDays.toFixed(1)} d</span>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-[180px]">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium ${hoursStatus.color}`}>
                            {formatHours(user.totalHours)} / {formatHours(target)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{user.entriesCount} Einträge</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <Progress value={progressPct} className="h-2" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const overtime = user.overtimeBalance ?? 0
                        const isPositive = overtime > 0
                        const isNegative = overtime < 0
                        return (
                          <div
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${
                              isPositive
                                ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                                : isNegative
                                  ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
                                  : "border-border/70 bg-muted/40 text-muted-foreground"
                            }`}
                            title="Kumulierter Überstunden-Saldo seit Beginn der Erfassung"
                          >
                            {isPositive && <TrendingUp className="h-3 w-3" />}
                            {isNegative && <TrendingDown className="h-3 w-3" />}
                            {!isPositive && !isNegative && <Minus className="h-3 w-3" />}
                            {(isPositive ? "+" : "") + formatHours(overtime)}
                          </div>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex justify-end items-center gap-2 flex-wrap">
                        {canOpenManageMenu && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                                <BriefcaseBusiness className="h-3.5 w-3.5" />
                                <span className="text-xs">Verwalten</span>
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-72">
                              <DropdownMenuLabel>Mitarbeiter verwalten</DropdownMenuLabel>
                              <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground pt-0">{user.name}</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {canManageUserProfile && (
                                <>
                                  <DropdownMenuLabel className="text-[11px] text-muted-foreground">Urlaub & Team</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => setEditingCategory(user)}>
                                    <Tags className="mr-2 h-3.5 w-3.5" />
                                    Team-Zuordnung ändern
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setEditingVacationDays(user)}>
                                    <Plane className="mr-2 h-3.5 w-3.5" />
                                    Urlaubskontingent ändern
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setAbsenceUser(user)}>
                                    <CalendarDays className="mr-2 h-3.5 w-3.5" />
                                    Abwesenheit eintragen
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-[11px] text-muted-foreground">Rahmendaten</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => setEditingEmployee(user)}>
                                    <TimerReset className="mr-2 h-3.5 w-3.5" />
                                    Beschäftigung & Sollstunden
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setOvertimeAccountUser(user)}>
                                    <TrendingUp className="mr-2 h-3.5 w-3.5" />
                                    Überstundenkonto
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setEditingBundesland(user)}>
                                    <MapPinned className="mr-2 h-3.5 w-3.5" />
                                    Bundesland & Feiertage
                                  </DropdownMenuItem>
                                </>
                              )}
                              {canAssignProjects && (
                                <DropdownMenuItem onClick={() => setEditingProjects(user)}>
                                  <FolderTree className="mr-2 h-3.5 w-3.5" />
                                  Projekte zuweisen
                                </DropdownMenuItem>
                              )}
                              {canManagePermissions && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-[11px] text-muted-foreground">Rechte</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => setEditingAccessUser(user)}>
                                    <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                                    Rechte & Zugriffe
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}

                        {canViewEntries && (
                          <Link href={`/admin/users/${user.id}/entries`}>
                            <Button
                              size="sm"
                              variant={!canEditEntries ? "outline" : "default"}
                              className="h-8 gap-1.5"
                              title={!canEditEntries ? "Zeiteinträge ansehen" : "Zeiteinträge ansehen & bearbeiten"}
                            >
                              <ClipboardList className="h-3.5 w-3.5" />
                              <span className="text-xs">Einträge</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filteredUsers.length === 0 && (
        <Card className="border-dashed border-border/70 bg-card/60">
          <CardContent className="p-8 text-center">
            <p className="text-sm font-medium">Keine Mitarbeiter für den aktuellen Filter</p>
            <p className="mt-1 text-xs text-muted-foreground">Passe Suchbegriff, Team oder Beschäftigungsart an.</p>
          </CardContent>
        </Card>
      )}

      <CategoryDialog user={editingCategory} onClose={() => setEditingCategory(null)} onSaved={loadUsers} />
      <EmploymentDialog user={editingEmployee} onClose={() => setEditingEmployee(null)} onSaved={loadUsers} />
      <OvertimeAccountDialog
        user={overtimeAccountUser}
        onClose={() => setOvertimeAccountUser(null)}
        onChanged={loadUsers}
      />
      <VacationDaysDialog user={editingVacationDays} onClose={() => setEditingVacationDays(null)} onSaved={loadUsers} />
      <BundeslandDialog user={editingBundesland} onClose={() => setEditingBundesland(null)} onSaved={loadUsers} />
      <ProjectsDialog user={editingProjects} onClose={() => setEditingProjects(null)} onSaved={loadUsers} />
      <AbsenceDialog user={absenceUser} onClose={() => setAbsenceUser(null)} onSaved={loadUsers} />
      <AccessDialog user={editingAccessUser} onClose={() => setEditingAccessUser(null)} onSaved={loadUsers} />
    </div>
  )
}
