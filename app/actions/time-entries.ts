"use server"

import { getServerSession } from "@/lib/auth"
import {
  findOrCreateUser,
  getUserById,
  createTimeEntry,
  updateTimeEntry,
  getTimeEntriesForUser,
  deleteTimeEntry,
  getWeeklyHours,
  getOvertimeBalance as calcOvertime,
  getMonthlyOvertime,
  calculateHoursFromTimes,
  type TimeEntry,
} from "@/lib/db"
import { revalidatePath } from "next/cache"
import { differenceInDays, endOfMonth, format, startOfMonth, startOfWeek, subMonths } from "date-fns"
import { de } from "date-fns/locale"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUserAccess } from "@/lib/permissions-server"
import { canActorManageTargetTime } from "@/lib/visibility"

// Rückwirkendes Zeitfenster für eigene Einträge (Anlegen/Bearbeiten/Löschen).
// Nicht exportiert: "use server"-Dateien dürfen ausschließlich async Funktionen exportieren.
const RETRO_EDIT_DAYS = 5

/**
 * Eigene Einträge dürfen bearbeitet/gelöscht werden, wenn sie entweder in der
 * laufenden Kalenderwoche liegen (ab Montag) ODER höchstens RETRO_EDIT_DAYS zurück.
 * Die reine 5-Tage-Regel hat am Wochenende den Wochenanfang ausgesperrt (sonntags
 * ist Montag bereits 6 Tage her) – die Wochenregel schließt diese Lücke, ohne das
 * bisherige Fenster am Wochenanfang zu verkürzen.
 */
function isWithinEditableWindow(entryDate: Date): boolean {
  const today = new Date()
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 })

  if (entryDate >= currentWeekStart) {
    return true
  }

  return differenceInDays(today, entryDate) <= RETRO_EDIT_DAYS
}

export async function getCurrentUser() {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    return null
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  return user
}

export async function saveTimeEntry(formData: FormData) {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    throw new Error("Nicht angemeldet")
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const access = await getCurrentUserAccess()

  const date = formData.get("date") as string
  const description = (formData.get("description") as string) || null
  const projectId = (formData.get("project_id") as string) || null
  const entryId = formData.get("entry_id") as string | null

  const startTime = (formData.get("start_time") as string) || null
  const endTime = (formData.get("end_time") as string) || null

  // Stunden entweder aus Formular oder berechnen
  let hours: number
  if (startTime && endTime) {
    hours = calculateHoursFromTimes(startTime, endTime)
  } else {
    hours = Number.parseFloat(formData.get("hours") as string)
  }

  if (!date || isNaN(hours) || hours < 0 || hours > 24) {
    throw new Error("Ungültige Eingabe")
  }

  if (!access.canManageAllTimeEntries && !isWithinEditableWindow(new Date(date))) {
    throw new Error(
      "Einträge können nur in der laufenden Woche oder maximal 5 Tage rückwirkend bearbeitet werden",
    )
  }

  const entryDate = new Date(date)
  const { isMonthClosed } = await import("./month-closure")
  const monthClosed = await isMonthClosed(entryDate.getFullYear(), entryDate.getMonth() + 1)

  if (monthClosed && !access.canManageAllTimeEntries) {
    throw new Error("Dieser Monat wurde bereits abgeschlossen und kann nicht mehr bearbeitet werden")
  }

  if (entryId) {
    await updateTimeEntry(entryId, hours, description, projectId, startTime, endTime)
  } else {
    await createTimeEntry(user.id, date, hours, description, projectId, startTime, endTime)
  }

  revalidatePath("/dashboard")

  return { success: true }
}

export async function removeTimeEntry(entryId: string) {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    throw new Error("Nicht angemeldet")
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const access = await getCurrentUserAccess()
  const supabase = await createClient()
  const { data: entryRow } = await supabase.from("time_entries").select("user_id, date").eq("id", entryId).single()

  if (!entryRow) {
    throw new Error("Eintrag nicht gefunden")
  }

  const entryUserId = entryRow.user_id as string
  const isOwnEntry = entryUserId === user.id

  if (!isOwnEntry) {
    const target = await getUserById(entryUserId)
    if (!target || !canActorManageTargetTime(user, target, access)) {
      throw new Error("Kein Zugriff")
    }
  } else if (!access.canManageAllTimeEntries) {
    const entryDate = new Date(entryRow.date as string)

    const { isMonthClosed } = await import("./month-closure")
    const monthClosed = await isMonthClosed(entryDate.getFullYear(), entryDate.getMonth() + 1)

    if (monthClosed) {
      throw new Error("Dieser Monat wurde bereits abgeschlossen und Einträge können nicht mehr gelöscht werden")
    }

    if (!isWithinEditableWindow(entryDate)) {
      throw new Error(
        "Einträge können nur in der laufenden Woche oder maximal 5 Tage rückwirkend gelöscht werden",
      )
    }
  }

  await deleteTimeEntry(entryId, entryUserId)
  revalidatePath("/dashboard")

  return { success: true }
}

export async function getMyTimeEntries(startDate: string, endDate: string) {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    return []
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  return getTimeEntriesForUser(user.id, startDate, endDate)
}

export async function getMyWeeklyHours(weekStart: string, weekEnd: string) {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    return 0
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  return getWeeklyHours(user.id, weekStart, weekEnd)
}

export async function getOvertimeBalance() {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    return 0
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  return calcOvertime(user.id)
}

export async function getMonthlyOvertimeData(year: number, month: number) {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    return 0
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  return getMonthlyOvertime(user.id, year, month)
}

export async function saveTimeEntryForUser(targetUserId: string, formData: FormData) {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    throw new Error("Nicht angemeldet")
  }

  const actor = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const access = await getCurrentUserAccess()
  const target = await getUserById(targetUserId)
  if (!target || !canActorManageTargetTime(actor, target, access)) {
    throw new Error("Kein Zugriff")
  }

  const date = formData.get("date") as string
  const description = (formData.get("description") as string) || null
  const projectId = (formData.get("project_id") as string) || null
  const entryId = formData.get("entry_id") as string | null
  const startTime = (formData.get("start_time") as string) || null
  const endTime = (formData.get("end_time") as string) || null

  let hours: number
  if (startTime && endTime) {
    hours = calculateHoursFromTimes(startTime, endTime)
  } else {
    hours = Number.parseFloat(formData.get("hours") as string)
  }

  if (!date || isNaN(hours) || hours < 0 || hours > 24) {
    throw new Error("Ungültige Eingabe")
  }

  if (entryId) {
    await updateTimeEntry(entryId, hours, description, projectId, startTime, endTime)
  } else {
    await createTimeEntry(targetUserId, date, hours, description, projectId, startTime, endTime)
  }

  revalidatePath("/admin")
  return { success: true }
}

export type OvertimeTrendPoint = { month: string; delta: number }

/**
 * Über-/Unterstunden der letzten `monthsBack` Monate.
 *
 * Ersetzt die frühere Variante, die pro Monat eine eigene Server Action aufrief:
 * Next.js reiht Server-Action-Aufrufe client-seitig in eine Queue ein und führt sie
 * strikt nacheinander aus, ein `Promise.all` im Client half also nicht. Hier läuft
 * jetzt alles in einem Roundtrip mit einer einzigen Zeiteintrags-Query.
 */
export async function getOvertimeTrend(monthsBack = 6): Promise<OvertimeTrendPoint[]> {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    return []
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const monthlyTarget = user.monthly_hours || 173

  const now = new Date()
  const months = Array.from({ length: monthsBack }, (_, i) => startOfMonth(subMonths(now, monthsBack - 1 - i)))

  const supabase = await createClient()
  const { data: entries } = await supabase
    .from("time_entries")
    .select("date, hours")
    .eq("user_id", user.id)
    .gte("date", format(months[0], "yyyy-MM-dd"))
    .lte("date", format(endOfMonth(now), "yyyy-MM-dd"))

  const actualByMonth = new Map<string, number>()
  for (const entry of entries || []) {
    const key = entry.date.slice(0, 7) // yyyy-MM
    actualByMonth.set(key, (actualByMonth.get(key) || 0) + Number(entry.hours))
  }

  return months.map((monthDate) => ({
    month: format(monthDate, "MMM", { locale: de }),
    delta: Math.round(((actualByMonth.get(format(monthDate, "yyyy-MM")) || 0) - monthlyTarget) * 100) / 100,
  }))
}

export type WeekBoardData = {
  entries: (TimeEntry & { project_name: string | null; project_color: string | null })[]
  projects: { id: string; name: string; color: string | null }[]
  holidays: { date: string; name: string }[]
  /** Monate ("yyyy-MM"), die von dieser Woche berührt und bereits abgeschlossen sind. */
  closedMonths: string[]
  /** Frühestes Datum, das der Nutzer noch selbst bearbeiten darf (null = unbeschränkt). */
  editableFrom: string | null
}

/**
 * Alle Daten des Wochen-Boards in EINEM Server-Action-Roundtrip: Einträge inkl.
 * Projektnamen, verfügbare Projekte, Feiertage und Monatsabschluss-Status.
 */
export async function getWeekBoard(weekStart: string, weekEnd: string): Promise<WeekBoardData | null> {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    return null
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const access = await getCurrentUserAccess()
  const supabase = await createClient()

  const monthKeys = Array.from(new Set([weekStart.slice(0, 7), weekEnd.slice(0, 7)]))

  // Feiertage über dieselbe Quelle wie die Monatsübersicht holen: die Tabelle "holidays"
  // ist in der Regel leer, die tatsächlichen Feiertage werden aus dem Bundesland berechnet.
  const { getHolidaysForYear } = await import("./holidays")
  const bundesland = (user.bundesland || "BY") as Parameters<typeof getHolidaysForYear>[1]

  const [entriesRes, assignedRes, holidayYears, closuresRes] = await Promise.all([
    supabase
      .from("time_entries")
      .select("*, projects(name, color)")
      .eq("user_id", user.id)
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .order("start_time", { ascending: true, nullsFirst: false }),
    supabase.from("user_projects").select("project_id").eq("user_id", user.id),
    Promise.all(
      Array.from(new Set([weekStart.slice(0, 4), weekEnd.slice(0, 4)])).map((y) =>
        getHolidaysForYear(Number(y), bundesland),
      ),
    ),
    supabase
      .from("month_closures")
      .select("year, month")
      .eq("user_id", user.id)
      .in(
        "month",
        monthKeys.map((key) => Number(key.slice(5, 7))),
      ),
  ])

  const weekHolidays = holidayYears
    .flat()
    .filter((h) => h.date >= weekStart && h.date <= weekEnd)

  const assignedIds = (assignedRes.data || []).map((row) => row.project_id)
  const projectQuery = supabase.from("projects").select("id, name, color").eq("is_active", true).order("name")
  const { data: projects } = assignedIds.length > 0 ? await projectQuery.in("id", assignedIds) : await projectQuery

  const closedMonths = (closuresRes.data || [])
    .map((row) => `${row.year}-${String(row.month).padStart(2, "0")}`)
    .filter((key) => monthKeys.includes(key))

  const editableFrom = access.canManageAllTimeEntries
    ? null
    : format(
        new Date(
          Math.min(
            startOfWeek(new Date(), { weekStartsOn: 1 }).getTime(),
            new Date().getTime() - RETRO_EDIT_DAYS * 24 * 60 * 60 * 1000,
          ),
        ),
        "yyyy-MM-dd",
      )

  return {
    entries: (entriesRes.data || []).map((entry) => ({
      ...entry,
      project_name: entry.projects?.name ?? null,
      project_color: entry.projects?.color ?? null,
    })) as WeekBoardData["entries"],
    projects: projects || [],
    holidays: weekHolidays.map((h) => ({ date: h.date, name: h.name })),
    closedMonths,
    editableFrom,
  }
}

export type MonthBoardData = {
  entries: TimeEntry[]
  holidays: { id: string; name: string; date: string; bundesland: string | null }[]
  isClosed: boolean
  canClose: boolean
}

/**
 * Monatsübersicht in EINEM Roundtrip statt vier einzelnen Server Actions
 * (Einträge, Feiertage, Abschluss-Status, Abschluss-Berechtigung). Ein `Promise.all`
 * im Client hätte nicht geholfen, da Next.js Server Actions dort serialisiert.
 */
export async function getMonthBoard(year: number, month: number): Promise<MonthBoardData | null> {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    return null
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const startDate = format(startOfMonth(new Date(year, month - 1, 1)), "yyyy-MM-dd")
  const endDate = format(endOfMonth(new Date(year, month - 1, 1)), "yyyy-MM-dd")

  const { getHolidaysForYear } = await import("./holidays")
  const { canCloseMonth } = await import("./month-closure")
  const supabase = await createClient()

  const [entries, holidays, closureRes, canClose] = await Promise.all([
    getTimeEntriesForUser(user.id, startDate, endDate),
    getHolidaysForYear(year, (user.bundesland || "BY") as Parameters<typeof getHolidaysForYear>[1]),
    supabase
      .from("month_closures")
      .select("id")
      .eq("user_id", user.id)
      .eq("year", year)
      .eq("month", month)
      .maybeSingle(),
    canCloseMonth(year, month),
  ])

  return { entries, holidays, isClosed: !!closureRes.data, canClose }
}
