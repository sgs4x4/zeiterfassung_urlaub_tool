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
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Users, CalendarIcon, ChevronRight, ChevronDown, ClipboardList, Info, Search, MoreHorizontal, ArrowUpDown, BriefcaseBusiness, TimerReset, Tags, Plane, FolderTree, MapPinned, SlidersHorizontal, X } from "lucide-react"
import {
  getAdminDashboardData,
  getUserAccessConfig,
  saveUserAccessConfig,
  updateUserEmployeeType,
  updateUserWeeklySchedule,
  updateUserBundesland,
  updateUserCategory,
  updateUserVacationDays,
} from "@/app/actions/admin"
import { getAllProjects, getUserProjectIds, assignProjectsToUser, type Project } from "@/app/actions/projects"
import { type User, type EmployeeType, type UserCategory, type Weekday, type WeeklySchedule, EMPLOYEE_TYPE_DEFAULTS, USER_CATEGORY_LABELS } from "@/lib/db"
import { buildPermissionMap, type AccessProfile, type AppPermission, type PermissionGroup } from "@/lib/permissions"
import { formatHours } from "@/lib/utils"

const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Mo",
  tuesday: "Di",
  wednesday: "Mi",
  thursday: "Do",
  friday: "Fr",
  saturday: "Sa",
  sunday: "So",
}

const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  monday: 8,
  tuesday: 8,
  wednesday: 8,
  thursday: 8,
  friday: 8,
  saturday: 0,
  sunday: 0,
}

const DEFAULT_WEEKLY_SCHEDULE_INPUTS: Record<Weekday, string> = WEEKDAYS.reduce((acc, day) => ({
  ...acc,
  [day]: `${Math.floor(DEFAULT_WEEKLY_SCHEDULE[day])}:${String(Math.round((DEFAULT_WEEKLY_SCHEDULE[day] % 1) * 60)).padStart(2, "0")}`,
}), {} as Record<Weekday, string>)

function formatHoursInput(value: number) {
  const hours = Math.floor(value)
  const minutes = Math.round((value - hours) * 60)
  return `${hours}:${String(minutes).padStart(2, "0")}`
}

function parseHoursInput(value: string) {
  const normalized = value.replace(",", ".").trim()
  if (normalized.includes(":")) {
    const [hoursStr, minutesStr] = normalized.split(":")
    const hours = Number.parseInt(hoursStr, 10)
    const minutes = Number.parseInt(minutesStr, 10)
    if (!Number.isNaN(hours) && !Number.isNaN(minutes) && minutes >= 0 && minutes < 60) {
      return hours + minutes / 60
    }
  }
  const numberValue = Number.parseFloat(normalized)
  return Number.isNaN(numberValue) ? 0 : numberValue
}

import { format, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { de } from "date-fns/locale"
import { BUNDESLAENDER, type Bundesland } from "@/lib/holidays"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"

interface UserWithStats extends User {
  totalHours: number
  entriesCount: number
  usedVacationDays?: number
  pendingVacationDays?: number
  remainingVacationDays?: number
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
  const [sortBy, setSortBy] = useState<"name" | "hours" | "vacation">("name")

  const [editingEmployee, setEditingEmployee] = useState<User | null>(null)
  const [employeeTypeValue, setEmployeeTypeValue] = useState<EmployeeType>("vollzeit")
  const [monthlyHoursValue, setMonthlyHoursValue] = useState("")
  const [weeklyScheduleValue, setWeeklyScheduleValue] = useState<WeeklySchedule>(DEFAULT_WEEKLY_SCHEDULE)
  const [weeklyScheduleInputs, setWeeklyScheduleInputs] = useState<Record<Weekday, string>>(DEFAULT_WEEKLY_SCHEDULE_INPUTS)
  const [employeeSaveStatus, setEmployeeSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle")
  const [employeeSaveMessage, setEmployeeSaveMessage] = useState<string | null>(null)

  const [editingBundesland, setEditingBundesland] = useState<User | null>(null)
  const [bundeslandValue, setBundeslandValue] = useState<Bundesland>("BY")

  const [editingProjects, setEditingProjects] = useState<User | null>(null)
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])

  const [editingCategory, setEditingCategory] = useState<User | null>(null)
  const [categoryValue, setCategoryValue] = useState<UserCategory>("sonstiges")
  const [editingVacationDays, setEditingVacationDays] = useState<User | null>(null)
  const [vacationDaysValue, setVacationDaysValue] = useState("30")
  const [editingAccessUser, setEditingAccessUser] = useState<User | null>(null)
  const [accessProfileValue, setAccessProfileValue] = useState<AccessProfile>("employee")
  const [permissionValues, setPermissionValues] = useState<Partial<Record<AppPermission, boolean>>>({})
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([])
  const [isSavingAccess, setIsSavingAccess] = useState(false)

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

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return

    setEmployeeSaveStatus("saving")
    setEmployeeSaveMessage(null)

    const parsedSchedule = WEEKDAYS.reduce((acc, day) => {
      const hours = parseHoursInput(weeklyScheduleInputs[day] ?? "0")
      return {
        ...acc,
        [day]: hours,
      }
    }, {} as WeeklySchedule)

    try {
      await updateUserEmployeeType(editingEmployee.id, employeeTypeValue, Number.parseFloat(monthlyHoursValue))
      await updateUserWeeklySchedule(editingEmployee.id, parsedSchedule)
      setWeeklyScheduleValue(parsedSchedule)
      setWeeklyScheduleInputs(
        WEEKDAYS.reduce((acc, day) => ({
          ...acc,
          [day]: formatHoursInput(parsedSchedule[day]),
        }), {} as Record<Weekday, string>),
      )
      setEmployeeSaveStatus("success")
      setEmployeeSaveMessage("Sollstunden erfolgreich gespeichert.")
      loadUsers()
      setTimeout(() => {
        setEditingEmployee(null)
        setEmployeeSaveStatus("idle")
        setEmployeeSaveMessage(null)
      }, 1200)
    } catch (error) {
      console.error("Fehler beim Aktualisieren:", error)
      setEmployeeSaveStatus("error")
      setEmployeeSaveMessage(error instanceof Error ? error.message : "Fehler beim Speichern")
    }
  }

  const handleUpdateBundesland = async () => {
    if (!editingBundesland) return
    try {
      await updateUserBundesland(editingBundesland.id, bundeslandValue)
      setEditingBundesland(null)
      loadUsers()
    } catch (error) {
      console.error("Fehler beim Aktualisieren:", error)
    }
  }

  const handleOpenProjectsDialog = async (user: User) => {
    setEditingProjects(user)
    try {
      const [projects, assignedIds] = await Promise.all([getAllProjects(), getUserProjectIds(user.id)])
      setAllProjects(projects)
      setSelectedProjectIds(assignedIds)
    } catch (error) {
      console.error("Fehler beim Laden der Projekte:", error)
    }
  }

  const handleUpdateProjects = async () => {
    if (!editingProjects) return
    try {
      await assignProjectsToUser(editingProjects.id, selectedProjectIds)
      setEditingProjects(null)
      loadUsers()
    } catch (error) {
      console.error("Fehler beim Aktualisieren:", error)
    }
  }

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId],
    )
  }

  const handleUpdateCategory = async () => {
    if (!editingCategory) return
    try {
      await updateUserCategory(editingCategory.id, categoryValue)
      setEditingCategory(null)
      loadUsers()
    } catch (error) {
      console.error("Fehler beim Aktualisieren der Teams:", error)
    }
  }

  const handleUpdateVacationDays = async () => {
    if (!editingVacationDays) return
    try {
      await updateUserVacationDays(editingVacationDays.id, Number.parseFloat(vacationDaysValue))
      setEditingVacationDays(null)
      loadUsers()
    } catch (error) {
      console.error("Fehler beim Aktualisieren der Urlaubstage:", error)
    }
  }

  const handleOpenAccessDialog = async (user: User) => {
    setEditingAccessUser(user)
    try {
      const config = await getUserAccessConfig(user.id)
      setAccessProfileValue(config.profile)
      setPermissionValues(config.permissions)
      setPermissionGroups(config.groups)
    } catch (error) {
      console.error("Fehler beim Laden der Rechte:", error)
    }
  }

  const handleTogglePermission = (permission: AppPermission, enabled: boolean) => {
    setPermissionValues((prev) => ({ ...prev, [permission]: enabled }))
  }

  const handleSaveAccess = async () => {
    if (!editingAccessUser) return

    setIsSavingAccess(true)
    try {
      await saveUserAccessConfig({
        userId: editingAccessUser.id,
        profile: accessProfileValue,
        permissions: permissionValues,
      })
      setEditingAccessUser(null)
      loadUsers()
    } catch (error) {
      console.error("Fehler beim Speichern der Rechte:", error)
    } finally {
      setIsSavingAccess(false)
    }
  }

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
      return a.name.localeCompare(b.name, "de")
    })

    return result
  }, [users, searchTerm, employeeTypeFilters, categoryFilters, sortBy])

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
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as "name" | "hours" | "vacation") }>
                <SelectTrigger className="h-8 w-[230px]">
                  <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sortierung: Name (A–Z)</SelectItem>
                  <SelectItem value="hours">Sortierung: Stunden (absteigend)</SelectItem>
                  <SelectItem value="vacation">Sortierung: Resturlaub (absteigend)</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 px-2 text-xs">
                  <X className="mr-1 h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
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
                                  <DropdownMenuItem onClick={() => {
                                    setEditingCategory(user)
                                    setCategoryValue((user.category as UserCategory) || "sonstiges")
                                  }}>
                                    <Tags className="mr-2 h-3.5 w-3.5" />
                                    Team-Zuordnung ändern
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setEditingVacationDays(user)
                                    setVacationDaysValue((user.vacation_days_per_year || 30).toString())
                                  }}>
                                    <Plane className="mr-2 h-3.5 w-3.5" />
                                    Urlaubskontingent ändern
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-[11px] text-muted-foreground">Rahmendaten</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => {
                                    const schedule = typeof user.weekly_schedule === "string"
                                      ? JSON.parse(user.weekly_schedule as string)
                                      : user.weekly_schedule || DEFAULT_WEEKLY_SCHEDULE
                                    setEditingEmployee(user)
                                    setEmployeeTypeValue((user.employee_type as EmployeeType) || "vollzeit")
                                    setMonthlyHoursValue((user.monthly_hours || 173).toString())
                                    setWeeklyScheduleValue(schedule)
                                    setWeeklyScheduleInputs(
                                      WEEKDAYS.reduce((acc, day) => ({
                                        ...acc,
                                        [day]: formatHoursInput(schedule[day] ?? 0),
                                      }), {} as Record<Weekday, string>),
                                    )
                                    setEmployeeSaveStatus("idle")
                                    setEmployeeSaveMessage(null)
                                  }}>
                                    <TimerReset className="mr-2 h-3.5 w-3.5" />
                                    Beschäftigung & Sollstunden
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setEditingBundesland(user)
                                    setBundeslandValue((user.bundesland as Bundesland) || "BY")
                                  }}>
                                    <MapPinned className="mr-2 h-3.5 w-3.5" />
                                    Bundesland & Feiertage
                                  </DropdownMenuItem>
                                </>
                              )}
                              {canAssignProjects && (
                                <DropdownMenuItem onClick={() => handleOpenProjectsDialog(user)}>
                                  <FolderTree className="mr-2 h-3.5 w-3.5" />
                                  Projekte zuweisen
                                </DropdownMenuItem>
                              )}
                              {canManagePermissions && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-[11px] text-muted-foreground">Rechte</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => handleOpenAccessDialog(user)}>
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

      <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Team-Zuordnung ändern</DialogTitle>
            <DialogDescription>
              Lege fest, welchem Team <strong>{editingCategory?.name}</strong> zugeordnet ist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={categoryValue} onValueChange={(v) => setCategoryValue(v as UserCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(USER_CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Die Team-Zuordnung steuert Urlaubsregeln und Auswertungen.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
              <Button variant="outline" onClick={() => setEditingCategory(null)}>Schließen</Button>
              <Button onClick={handleUpdateCategory}>Änderung speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingEmployee} onOpenChange={() => setEditingEmployee(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Beschäftigung & Sollstunden</DialogTitle>
            <DialogDescription>
              Pflege Vertragsart und monatliches Soll für <strong>{editingEmployee?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Beschäftigungsart</Label>
              <Select
                value={employeeTypeValue}
                onValueChange={(value: EmployeeType) => {
                  setEmployeeTypeValue(value)
                  setMonthlyHoursValue((EMPLOYEE_TYPE_DEFAULTS[value] ?? 173).toString())
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vollzeit">Vollzeit (173h/Monat)</SelectItem>
                  <SelectItem value="teilzeit">Teilzeit (individuell)</SelectItem>
                  <SelectItem value="minijob">Minijob (max. 43h/Monat bei 603€ / 13,90€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monatsstunden-Soll</Label>
              <Input
                type="number"
                step="0.5"
                value={monthlyHoursValue}
                onChange={(e) => setMonthlyHoursValue(e.target.value)}
              />
              {employeeTypeValue === "minijob" && (
                <p className="text-xs text-muted-foreground mt-1">Max. 43h bei 603€-Grenze und 13,90€ Mindestlohn (2026)</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Wochenplan Mo–So</Label>
              <div className="grid grid-cols-2 gap-3">
                {WEEKDAYS.map((weekday) => (
                  <div key={weekday} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{WEEKDAY_LABELS[weekday]}</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9:,]*"
                      placeholder="8:00"
                      value={weeklyScheduleInputs[weekday] ?? "0:00"}
                      onChange={(e) => setWeeklyScheduleInputs((prev) => ({
                        ...prev,
                        [weekday]: e.target.value,
                      }))}
                      onBlur={(e) => {
                        const parsed = parseHoursInput(e.target.value)
                        setWeeklyScheduleInputs((prev) => ({
                          ...prev,
                          [weekday]: formatHoursInput(parsed),
                        }))
                      }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Summe: {formatHours(Object.values(WEEKDAYS).reduce((sum, day) => sum + parseHoursInput(weeklyScheduleInputs[day] ?? "0"), 0))} / Woche
              </p>
              {employeeSaveMessage && (
                <Alert variant={employeeSaveStatus === "error" ? "destructive" : "default"} className="mt-2">
                  <AlertDescription>{employeeSaveMessage}</AlertDescription>
                </Alert>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
              <Button variant="outline" onClick={() => setEditingEmployee(null)}>Schließen</Button>
              <Button onClick={handleUpdateEmployee}>Änderung speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingVacationDays} onOpenChange={() => setEditingVacationDays(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Urlaubskontingent ändern</DialogTitle>
            <DialogDescription>
              Definiere das jährliche Urlaubskontingent für <strong>{editingVacationDays?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Urlaubstage / Jahr</Label>
              <Input
                type="number"
                min="0"
                max="60"
                step="0.5"
                value={vacationDaysValue}
                onChange={(e) => setVacationDaysValue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Diese Anzahl wird in der Urlaubsplanung als Jahreskontingent verwendet.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
              <Button variant="outline" onClick={() => setEditingVacationDays(null)}>Schließen</Button>
              <Button onClick={handleUpdateVacationDays}>Änderung speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingBundesland} onOpenChange={() => setEditingBundesland(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bundesland & Feiertage</DialogTitle>
            <DialogDescription>
              Wähle das Bundesland für <strong>{editingBundesland?.name}</strong>. Dadurch werden Feiertage korrekt berücksichtigt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Bundesland</Label>
              <Select value={bundeslandValue} onValueChange={(value: Bundesland) => setBundeslandValue(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BUNDESLAENDER).map(([code, name]) => (
                    <SelectItem key={code} value={code}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
              <Button variant="outline" onClick={() => setEditingBundesland(null)}>Schließen</Button>
              <Button onClick={handleUpdateBundesland}>Änderung speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingProjects} onOpenChange={() => setEditingProjects(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Projekte zuweisen</DialogTitle>
            <DialogDescription>
              Wähle die Projekte, auf die <strong>{editingProjects?.name}</strong> buchen darf. Ohne Auswahl kann auf alle Projekte gebucht werden.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {allProjects.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">Keine Projekte vorhanden</p>
            ) : (
              allProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => toggleProjectSelection(project.id)}
                >
                  <Checkbox
                    checked={selectedProjectIds.includes(project.id)}
                    onCheckedChange={() => toggleProjectSelection(project.id)}
                  />
                  <div className="w-3 h-3 rounded-full shrink-0 bg-primary/40" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{project.name}</p>
                    {project.description && <p className="text-xs text-muted-foreground">{project.description}</p>}
                  </div>
                  {!project.is_active && <Badge variant="secondary" className="text-xs">Inaktiv</Badge>}
                </div>
              ))
            )}
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-border/70">
            <p className="text-sm text-muted-foreground">
              {selectedProjectIds.length} von {allProjects.length} ausgewählt
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingProjects(null)}>Schließen</Button>
              <Button onClick={handleUpdateProjects}>Änderung speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingAccessUser} onOpenChange={() => setEditingAccessUser(null)}>
        <DialogContent className="w-[99vw] !max-w-[1400px] sm:!max-w-[1400px] max-h-[92vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Rechte & Zugriffe</DialogTitle>
            <DialogDescription>
              Definiere Themenrechte und Einzelberechtigungen für <strong>{editingAccessUser?.name}</strong> direkt im Tool.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 overflow-y-auto px-6 pb-6">
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="space-y-2">
                <Label>Zugriffsprofil</Label>
                <Select
                  value={accessProfileValue}
                  onValueChange={(value) => {
                    const v = value as AccessProfile
                    setAccessProfileValue(v)
                    setPermissionValues({ ...buildPermissionMap(v) })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Mitarbeiter</SelectItem>
                    <SelectItem value="reporter">Reporter / Lesend</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {accessProfileValue === "admin"
                    ? "Admin hat immer vollen Zugriff auf alle Bereiche — ohne Einzelschalter."
                    : "Das Profil setzt die Basis. Die Schalter darunter erlauben die Feineinstellung pro Thema (Zeiterfassung, Urlaub, …)."}
                </p>
              </div>

              <Card className="border-border/70 bg-muted/30">
                <CardContent className="p-4">
                  <p className="text-sm font-medium">Hinweis</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rechte werden nur in dieser Anwendung gespeichert (Datenbank), nicht über Microsoft-Gruppen gesteuert.
                  </p>
                </CardContent>
              </Card>
            </div>

            {accessProfileValue === "admin" ? (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <p className="text-sm font-medium">Vollzugriff (Admin)</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dieses Profil umfasst Zeiterfassung, Urlaub und Verwaltung ohne weitere Aufteilung.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Tabs defaultValue={permissionGroups[0]?.key || "admin"} className="gap-4">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                  {permissionGroups.map((group) => (
                    <TabsTrigger key={group.key} value={group.key}>{group.label}</TabsTrigger>
                  ))}
                </TabsList>

                {permissionGroups.map((group) => (
                  <TabsContent key={group.key} value={group.key}>
                    <div className="rounded-xl border border-border/70 bg-card/90">
                      <div className="border-b border-border/70 px-4 py-3">
                        <p className="font-medium">{group.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{group.description}</p>
                      </div>
                      <div className="divide-y divide-border/70">
                        {group.permissions.map((permission) => (
                          <div key={permission.key} className="flex items-start justify-between gap-4 px-4 py-3">
                            <div className="space-y-1">
                              <p className="text-sm font-medium">{permission.label}</p>
                              <p className="text-xs text-muted-foreground">{permission.description}</p>
                            </div>
                            <Switch
                              checked={!!permissionValues[permission.key]}
                              onCheckedChange={(checked) => handleTogglePermission(permission.key, checked)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}

            <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex justify-end gap-2 border-t border-border/70 pt-3">
              <Button variant="outline" onClick={() => setEditingAccessUser(null)} disabled={isSavingAccess}>Schließen</Button>
              <Button onClick={handleSaveAccess} disabled={isSavingAccess}>
                {isSavingAccess ? "Speichere..." : "Rechte speichern"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}