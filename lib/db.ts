import { createClient } from "@/lib/supabase/server"
import { format, eachDayOfInterval } from "date-fns"
import { getServerSession } from "@/lib/auth"
import type { Holiday, Bundesland } from "@/lib/holidays"

export type EmployeeType = "vollzeit" | "teilzeit" | "minijob"

export type UserRole = "employee" | "admin" | "reporter"
export type UserCategory = "vertrieb" | "werkstatt" | "lager" | "buero" | "sonstiges"

export type VacationRestrictionDay = "montag" | "dienstag" | "mittwoch" | "donnerstag" | "freitag"

export type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"
export type WeeklySchedule = Record<Weekday, number>

export type User = {
  id: string
  azure_id: string
  email: string
  name: string
  role: UserRole
  notify_vacation_status: boolean
  notify_vacation_pending: boolean
  notify_vacation_approved: boolean
  notify_vacation_rejected: boolean
  notify_vacation_withdrawn: boolean
  weekly_hours: number
  weekly_schedule: WeeklySchedule | null
  monthly_hours: number
  vacation_days_per_year: number
  employee_type: EmployeeType
  bundesland: string
  category: UserCategory | null
  /** Ab diesem Datum zählen Monate für den Überstunden-Saldo (siehe getOvertimeBalance). */
  overtime_tracking_start_date: string
  /** Einmaliger manueller Start-Saldo (z.B. aus einem Vorgängersystem), wird zum Saldo addiert. */
  overtime_baseline_hours: number
  created_at: string
  updated_at: string
}

export const USER_CATEGORY_LABELS: Record<UserCategory, string> = {
  vertrieb: "Vertrieb",
  werkstatt: "Werkstatt",
  lager: "Lager",
  buero: "Büro",
  sonstiges: "Sonstiges",
}

export const VACATION_RESTRICTIONS: Record<UserCategory, VacationRestrictionDay[]> = {
  vertrieb: [],
  werkstatt: [],
  lager: [],
  buero: [],
  sonstiges: [],
}

const DAY_NAMES = ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"]

export function isVacationAllowedForCategory(category: UserCategory | null, date: Date): boolean {
  if (!category) return true
  
  const restrictions = VACATION_RESTRICTIONS[category]
  if (!restrictions || restrictions.length === 0) return true
  
  const dayOfWeek = date.getDay()
  const dayName = DAY_NAMES[dayOfWeek] as VacationRestrictionDay
  
  return !restrictions.includes(dayName)
}

export const EMPLOYEE_TYPE_DEFAULTS: Record<EmployeeType, number> = {
  vollzeit: 173,
  teilzeit: 87,
  minijob: 43,
}

/**
 * Ein historisierter Arbeitsverhältnis-Zeitraum (Tabelle user_employment_terms). Jede Änderung
 * an Beschäftigungsart/Soll-Stunden/Wochenplan erzeugt eine neue Zeile statt die users-Zeile
 * zu überschreiben – siehe scripts/019_user_employment_terms.sql und getMonthlyTargetHours().
 */
export type EmploymentTerm = {
  employeeType: EmployeeType
  monthlyHours: number
  weeklyHours: number
  weeklySchedule: WeeklySchedule
  validFrom: string // yyyy-MM-dd
  validTo: string | null // yyyy-MM-dd, null = aktuell gültig
}

export type TimeEntry = {
  id: string
  user_id: string
  date: string
  hours: number
  start_time: string | null
  end_time: string | null
  description: string | null
  project_id: string | null
  created_at: string
  updated_at: string
}

export async function findOrCreateUser(azureId: string, email: string, name: string): Promise<User> {
  const supabase = createClient()

  const { data: existingUser } = await supabase.from("users").select("*").eq("email", email).single()

  if (existingUser) {
    if (existingUser.azure_id !== azureId || existingUser.name !== name) {
      const { data: updatedUser } = await supabase
        .from("users")
        .update({ azure_id: azureId, name })
        .eq("email", email)
        .select()
        .single()
      return updatedUser as User
    }
    return existingUser as User
  }

  const defaultWeeklySchedule = {
    monday: 8,
    tuesday: 8,
    wednesday: 8,
    thursday: 8,
    friday: 8,
    saturday: 0,
    sunday: 0,
  }

  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      azure_id: azureId,
      email,
      name,
      bundesland: "BY",
      employee_type: "vollzeit",
      monthly_hours: 173,
      weekly_hours: 40,
      weekly_schedule: defaultWeeklySchedule,
      vacation_days_per_year: 30,
    })
    .select()
    .single()

  if (error) throw error

  // Startpunkt der Arbeitsverhältnis-Historie anlegen, damit getMonthlyTargetHours() auch für
  // den allerersten Monat dieses Nutzers einen historisierten Wert findet statt auf den
  // Fallback zurückzufallen. Nicht kritisch für die Kontoerstellung selbst (Fallback greift),
  // daher wird ein Fehler hier nur geloggt statt die Anmeldung zu blockieren.
  const { error: termsError } = await supabase.from("user_employment_terms").insert({
    user_id: newUser.id,
    employee_type: "vollzeit",
    monthly_hours: 173,
    weekly_hours: 40,
    weekly_schedule: defaultWeeklySchedule,
    valid_from: format(new Date(), "yyyy-MM-dd"),
    valid_to: null,
  })
  if (termsError) {
    console.error("[db] Konnte initiale Arbeitsverhältnis-Historie nicht anlegen:", termsError)
  }

  return newUser as User
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const supabase = createClient()
  const { data } = await supabase.from("users").select("*").eq("email", email).single()
  return data as User | null
}

export async function getUserById(id: string): Promise<User | null> {
  const supabase = createClient()
  const { data } = await supabase.from("users").select("*").eq("id", id).single()
  return data as User | null
}

export async function getUserByAzureId(azureId: string): Promise<User | null> {
  const supabase = createClient()
  const { data } = await supabase.from("users").select("*").eq("azure_id", azureId).single()
  return data as User | null
}

export async function getAllUsers(): Promise<User[]> {
  const supabase = createClient()
  const { data } = await supabase.from("users").select("*").order("name")
  return (data || []) as User[]
}

export async function createTimeEntry(
  userId: string,
  date: string,
  hours: number,
  description: string | null,
  projectId: string | null,
  startTime: string | null = null,
  endTime: string | null = null,
): Promise<TimeEntry> {
  const supabase = await createClient()

  // Überlappungsprüfung wenn Start/Endzeit gesetzt
  if (startTime && endTime) {
    const hasOverlap = await checkTimeOverlap(userId, date, startTime, endTime)
    if (hasOverlap) {
      throw new Error("Zeitraum überschneidet sich mit einem bestehenden Eintrag")
    }
  }

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      user_id: userId,
      date,
      hours,
      description,
      project_id: projectId,
      start_time: startTime,
      end_time: endTime,
    })
    .select()
    .single()

  if (error) throw error
  return data as TimeEntry
}

export async function updateTimeEntry(
  entryId: string,
  hours: number,
  description: string | null,
  projectId: string | null,
  startTime: string | null = null,
  endTime: string | null = null,
): Promise<TimeEntry> {
  const supabase = await createClient()

  // Hole zuerst den Eintrag um user_id und date zu bekommen
  const { data: existingEntry } = await supabase.from("time_entries").select("user_id, date").eq("id", entryId).single()

  // Überlappungsprüfung wenn Start/Endzeit gesetzt
  if (existingEntry && startTime && endTime) {
    const hasOverlap = await checkTimeOverlap(existingEntry.user_id, existingEntry.date, startTime, endTime, entryId)
    if (hasOverlap) {
      throw new Error("Zeitraum überschneidet sich mit einem bestehenden Eintrag")
    }
  }

  const { data, error } = await supabase
    .from("time_entries")
    .update({
      hours,
      description,
      project_id: projectId,
      start_time: startTime,
      end_time: endTime,
    })
    .eq("id", entryId)
    .select()
    .single()

  if (error) throw error
  return data as TimeEntry
}

export async function getTimeEntriesForUser(userId: string, startDate: string, endDate: string): Promise<TimeEntry[]> {
  const supabase = createClient()

  const { data } = await supabase
    .from("time_entries")
    .select("*")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })

  return (data || []) as TimeEntry[]
}

export async function getAllTimeEntries(startDate: string, endDate: string): Promise<(TimeEntry & { user: User })[]> {
  const supabase = createClient()

  const { data } = await supabase
    .from("time_entries")
    .select(`
      *,
      user:users(*)
    `)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })

  return (data || []) as (TimeEntry & { user: User })[]
}

export async function deleteTimeEntry(entryId: string, userId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from("time_entries").delete().eq("id", entryId).eq("user_id", userId)

  if (error) throw error
}

export async function getWeeklyHours(userId: string, weekStart: string, weekEnd: string): Promise<number> {
  const supabase = createClient()

  const { data } = await supabase
    .from("time_entries")
    .select("hours")
    .eq("user_id", userId)
    .gte("date", weekStart)
    .lte("date", weekEnd)

  return (data || []).reduce((sum, entry) => sum + Number(entry.hours), 0)
}

export async function getMonthlyHours(userId: string, year: number, month: number): Promise<number> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const endDate = new Date(year, month, 0).toISOString().split("T")[0]

  const supabase = createClient()

  const { data } = await supabase
    .from("time_entries")
    .select("hours")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)

  return (data || []).reduce((sum, entry) => sum + Number(entry.hours), 0)
}

async function fetchHolidaysForBundesland(bundesland: Bundesland, year: number): Promise<Holiday[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("holidays")
    .select("*")
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`)
    .or(`bundesland.is.null,bundesland.eq.${bundesland}`)
    .order("date")

  if (error) {
    console.error("Error fetching holidays:", error)
    return []
  }

  return data || []
}

/**
 * Liest alle Arbeitsverhältnis-Zeiträume, die sich mit [startDate, endDate] überschneiden.
 */
async function getEmploymentTermsOverlapping(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<EmploymentTerm[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("user_employment_terms")
    .select("employee_type, monthly_hours, weekly_hours, weekly_schedule, valid_from, valid_to")
    .eq("user_id", userId)
    .lte("valid_from", endDate)
    .or(`valid_to.is.null,valid_to.gte.${startDate}`)
    .order("valid_from")

  if (error) {
    console.error("[db] Fehler beim Lesen der Arbeitsverhältnis-Historie:", error)
    return []
  }

  return (data || []).map((row) => ({
    employeeType: row.employee_type as EmployeeType,
    monthlyHours: Number(row.monthly_hours),
    weeklyHours: Number(row.weekly_hours),
    weeklySchedule: row.weekly_schedule as WeeklySchedule,
    validFrom: row.valid_from as string,
    validTo: row.valid_to as string | null,
  }))
}

/** Wochentags-Schlüssel in der Reihenfolge von Date.getDay() (0 = Sonntag). */
const WEEKDAY_KEYS: Weekday[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  monday: 8,
  tuesday: 8,
  wednesday: 8,
  thursday: 8,
  friday: 8,
  saturday: 0,
  sunday: 0,
}

/**
 * Alle Daten, die für die taggenaue Soll-Berechnung eines Zeitraums nötig sind – bewusst EINMAL
 * geladen und dann für beliebig viele Monate synchron ausgewertet. Die Admin-Übersicht rechnet
 * den Saldo für jeden Mitarbeiter über die gesamte Historie; ohne dieses Bündeln entstünden
 * pro Mitarbeiter und Monat mehrere Queries.
 */
export type OvertimeContext = {
  terms: EmploymentTerm[]
  holidayDates: Set<string>
  /** Datum (yyyy-MM-dd) -> verbleibender Anteil des Tagessolls (0 = ganztägig abwesend, 0.5 = halber Tag). */
  absenceFactorByDate: Map<string, number>
  /** yyyy-MM-dd, davor zählt nichts für den Saldo (siehe scripts/020). */
  trackingStart: string | null
  /** Wochenplan aus users, falls für einen Tag kein historisierter Vertrag existiert. */
  fallbackSchedule: WeeklySchedule
}

export async function loadOvertimeContext(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<OvertimeContext> {
  const supabase = await createClient()

  const [{ data: user }, terms, { data: absences }] = await Promise.all([
    supabase
      .from("users")
      .select("bundesland, weekly_schedule, overtime_tracking_start_date")
      .eq("id", userId)
      .single(),
    getEmploymentTermsOverlapping(userId, startDate, endDate),
    supabase
      .from("absences")
      .select("start_date, end_date, day_part")
      .eq("user_id", userId)
      .eq("status", "approved")
      .lte("start_date", endDate)
      .gte("end_date", startDate),
  ])

  // Feiertage kommen aus derselben Quelle wie in der Monatsübersicht (aus dem Bundesland
  // berechnet, nicht aus der meist leeren holidays-Tabelle).
  const { getHolidaysForYear } = await import("@/app/actions/holidays")
  const bundesland = (user?.bundesland || "BY") as Bundesland
  const years: number[] = []
  for (let y = Number(startDate.slice(0, 4)); y <= Number(endDate.slice(0, 4)); y++) years.push(y)
  const holidays = (await Promise.all(years.map((year) => getHolidaysForYear(year, bundesland)))).flat()

  const absenceFactorByDate = new Map<string, number>()
  for (const absence of absences || []) {
    const isHalfDay = absence.day_part === "half_am" || absence.day_part === "half_pm"
    // day_part gilt nur für eintägige Abwesenheiten; mehrtägige sind immer ganztägig.
    const factor = isHalfDay && absence.start_date === absence.end_date ? 0.5 : 0
    const days = eachDayOfInterval({
      start: new Date(absence.start_date as string),
      end: new Date(absence.end_date as string),
    })
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd")
      // Überschneiden sich mehrere Abwesenheiten an einem Tag, gewinnt die weitreichendste.
      absenceFactorByDate.set(key, Math.min(absenceFactorByDate.get(key) ?? 1, factor))
    }
  }

  return {
    terms,
    holidayDates: new Set(holidays.map((h) => h.date)),
    absenceFactorByDate,
    trackingStart: (user?.overtime_tracking_start_date as string) || null,
    fallbackSchedule: (user?.weekly_schedule as WeeklySchedule) || DEFAULT_WEEKLY_SCHEDULE,
  }
}

function scheduleForDate(dateStr: string, ctx: OvertimeContext): WeeklySchedule {
  const term = ctx.terms.find((t) => t.validFrom <= dateStr && (t.validTo === null || t.validTo >= dateStr))
  return term?.weeklySchedule || ctx.fallbackSchedule
}

/**
 * Taggenaues Monats-Soll: Summe der Tagessollstunden aus dem Wochenplan, ohne Feiertage und
 * ohne genehmigte Abwesenheiten (Urlaub, Krankheit, Sonderfälle, Überstundenausgleich).
 *
 * Ersetzt die frühere Rechnung "pauschale monthly_hours, anteilig gekürzt". Die war doppelt
 * falsch: sie hat Urlaubs- und Krankheitstage als Fehlstunden gewertet (bezahlte Ausfallzeit
 * erfüllt aber das Soll) und Feiertage ignoriert. Taggenau löst zusätzlich Vertragswechsel und
 * Trackingbeginn ohne Bruchteilrechnerei – für jeden Tag gilt schlicht der an dem Tag gültige
 * Wochenplan.
 *
 * Tage in der Zukunft zählen nicht mit: im laufenden Monat ist das Soll damit "Stand heute" und
 * der Saldo springt nicht künstlich ins Minus, nur weil der Monat noch nicht vorbei ist.
 */
export function targetHoursForMonth(year: number, month: number, ctx: OvertimeContext, today = new Date()): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  const todayStr = format(today, "yyyy-MM-dd")
  let total = 0

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dateStr = format(date, "yyyy-MM-dd")

    if (ctx.trackingStart && dateStr < ctx.trackingStart) continue
    if (dateStr > todayStr) continue
    if (ctx.holidayDates.has(dateStr)) continue

    const dayTarget = Number(scheduleForDate(dateStr, ctx)[WEEKDAY_KEYS[date.getDay()]] ?? 0)
    if (dayTarget <= 0) continue

    total += dayTarget * (ctx.absenceFactorByDate.get(dateStr) ?? 1)
  }

  return Math.round(total * 100) / 100
}

/**
 * Planmäßige Arbeitsstunden eines Zeitraums nach Wochenplan, ohne Feiertage – aber bewusst OHNE
 * Berücksichtigung von Abwesenheiten. Beantwortet: "Wie viele Sollstunden deckt dieser Zeitraum
 * ab?" und liefert damit die Höhe einer Freizeitausgleich-Buchung. Über targetHoursForMonth ginge
 * das nicht: sobald der Ausgleich genehmigt ist, ist das Soll dieser Tage bereits auf 0 reduziert.
 */
export async function getScheduledHoursForRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const ctx = await loadOvertimeContext(userId, startDate, endDate)
  const days = eachDayOfInterval({ start: new Date(startDate), end: new Date(endDate) })

  let total = 0
  for (const day of days) {
    const dateStr = format(day, "yyyy-MM-dd")
    if (ctx.holidayDates.has(dateStr)) continue
    total += Number(scheduleForDate(dateStr, ctx)[WEEKDAY_KEYS[day.getDay()]] ?? 0)
  }

  return Math.round(total * 100) / 100
}

/** Taggenaues Soll für einen einzelnen Monat (lädt den Kontext selbst – für Einzelabfragen). */
export async function getMonthlyTargetHours(userId: string, year: number, month: number): Promise<number> {
  const startStr = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
  const endStr = format(new Date(year, month, 0), "yyyy-MM-dd")
  const ctx = await loadOvertimeContext(userId, startStr, endStr)
  return targetHoursForMonth(year, month, ctx)
}

/**
 * Einziger erlaubter Schreibpfad für Arbeitsverhältnis-Änderungen (Beschäftigungsart,
 * Monats-/Wochenstunden, Wochenplan). Ruft die atomare set_user_employment_terms()-Funktion
 * auf, statt users.* direkt zu überschreiben – siehe scripts/019_user_employment_terms.sql.
 */
export async function setUserEmploymentTerms(
  userId: string,
  terms: Pick<EmploymentTerm, "employeeType" | "monthlyHours" | "weeklyHours" | "weeklySchedule">,
  validFrom: string,
  createdBy: string | null,
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.rpc("set_user_employment_terms", {
    p_user_id: userId,
    p_employee_type: terms.employeeType,
    p_monthly_hours: terms.monthlyHours,
    p_weekly_hours: terms.weeklyHours,
    p_weekly_schedule: terms.weeklySchedule,
    p_valid_from: validFrom,
    p_created_by: createdBy,
  })

  if (error) throw error
}

export type OvertimeAdjustmentType = "payout" | "compensation" | "correction" | "opening_balance"

export type OvertimeAdjustment = {
  id: string
  user_id: string
  effective_date: string
  hours: number
  type: OvertimeAdjustmentType
  reason: string | null
  absence_id: string | null
  created_by: string | null
  created_at: string
}

/**
 * Kumulierter Überstunden-Saldo:
 *   (erfasste Zeit − taggenaues Soll) über alle Monate ab Trackingbeginn
 *   + Summe aller Buchungen (Auszahlung, Freizeitausgleich, Korrektur, Startsaldo)
 *
 * Es werden ALLE Monate ab Trackingbeginn gerechnet, nicht nur die mit Zeiteinträgen – ein
 * komplett unerfasster Monat soll als Fehlstunden sichtbar werden und nicht stillschweigend
 * verschwinden. Das Soll des laufenden Monats zählt nur bis heute (siehe targetHoursForMonth).
 */
export async function getOvertimeBalance(userId: string): Promise<number> {
  const supabase = await createClient()

  const [{ data: user }, { data: adjustments }] = await Promise.all([
    supabase.from("users").select("overtime_tracking_start_date").eq("id", userId).single(),
    supabase.from("overtime_adjustments").select("hours").eq("user_id", userId),
  ])

  if (!user) return 0

  const adjustmentTotal = (adjustments || []).reduce((sum, a) => sum + Number(a.hours), 0)

  const today = new Date()
  const todayStr = format(today, "yyyy-MM-dd")
  const trackingStart = (user.overtime_tracking_start_date as string) || null
  if (trackingStart && trackingStart > todayStr) {
    // Trackingbeginn liegt in der Zukunft: es gibt noch nichts zu rechnen.
    return Math.round(adjustmentTotal * 100) / 100
  }

  const { data: entries } = await supabase
    .from("time_entries")
    .select("date, hours")
    .eq("user_id", userId)
    .gte("date", trackingStart ?? "1900-01-01")
    .lte("date", todayStr)
    .order("date")

  const firstRelevantDate = trackingStart ?? entries?.[0]?.date
  if (!firstRelevantDate) {
    return Math.round(adjustmentTotal * 100) / 100
  }

  const ctx = await loadOvertimeContext(userId, firstRelevantDate, todayStr)

  const actualByMonth = new Map<string, number>()
  for (const entry of entries || []) {
    const monthKey = entry.date.slice(0, 7) // yyyy-MM
    actualByMonth.set(monthKey, (actualByMonth.get(monthKey) || 0) + Number(entry.hours))
  }

  let total = adjustmentTotal
  let cursor = new Date(Number(firstRelevantDate.slice(0, 4)), Number(firstRelevantDate.slice(5, 7)) - 1, 1)
  const lastMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  while (cursor <= lastMonth) {
    const year = cursor.getFullYear()
    const month = cursor.getMonth() + 1
    const monthKey = format(cursor, "yyyy-MM")
    total += (actualByMonth.get(monthKey) || 0) - targetHoursForMonth(year, month, ctx, today)
    cursor = new Date(year, month, 1)
  }

  return Math.round(total * 100) / 100
}

/** Über-/Unterstunden eines einzelnen Monats (ohne Buchungen – die hängen am Gesamtsaldo). */
export async function getMonthlyOvertime(userId: string, year: number, month: number): Promise<number> {
  const monthStart = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
  const monthEnd = format(new Date(year, month, 0), "yyyy-MM-dd")

  const ctx = await loadOvertimeContext(userId, monthStart, monthEnd)
  const targetHours = targetHoursForMonth(year, month, ctx)

  const supabase = await createClient()
  const { data: entries } = await supabase
    .from("time_entries")
    .select("hours")
    .eq("user_id", userId)
    .gte("date", ctx.trackingStart && ctx.trackingStart > monthStart ? ctx.trackingStart : monthStart)
    .lte("date", monthEnd)

  const actualHours = (entries || []).reduce((sum, e) => sum + Number(e.hours), 0)

  return Math.round((actualHours - targetHours) * 100) / 100
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return null
  }

  const userId = session.user.id || session.user.email
  const userName = session.user.name || session.user.email.split("@")[0]

  try {
    const user = await findOrCreateUser(userId, session.user.email, userName)
    return user
  } catch (error) {
    console.error("Error getting current user:", error)
    return null
  }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

export function calculateHoursFromTimes(startTime: string, endTime: string): number {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)

  if (endMinutes <= startMinutes) {
    throw new Error("Endzeit muss nach Startzeit liegen")
  }

  return (endMinutes - startMinutes) / 60
}

export async function checkTimeOverlap(
  userId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeEntryId?: string,
): Promise<boolean> {
  const supabase = await createClient()

  let query = supabase
    .from("time_entries")
    .select("id, start_time, end_time")
    .eq("user_id", userId)
    .eq("date", date)
    .not("start_time", "is", null)
    .not("end_time", "is", null)

  if (excludeEntryId) {
    query = query.neq("id", excludeEntryId)
  }

  const { data: existingEntries } = await query

  if (!existingEntries || existingEntries.length === 0) return false

  const newStart = timeToMinutes(startTime)
  const newEnd = timeToMinutes(endTime)

  for (const entry of existingEntries) {
    if (!entry.start_time || !entry.end_time) continue

    const existingStart = timeToMinutes(entry.start_time)
    const existingEnd = timeToMinutes(entry.end_time)

    // Prüfe auf Überlappung: Neuer Zeitraum überlappt mit bestehendem
    if (newStart < existingEnd && newEnd > existingStart) {
      return true // Überlappung gefunden
    }
  }

  return false
}
