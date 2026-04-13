import { createClient } from "@/lib/supabase/server"
import { format } from "date-fns"
import { getServerSession } from "@/lib/auth"
import type { Holiday, Bundesland } from "@/lib/holidays"

export type EmployeeType = "vollzeit" | "teilzeit" | "minijob"

export type UserRole = "employee" | "admin" | "reporter"
export type UserCategory = "vertrieb" | "werkstatt" | "lager" | "buero" | "sonstiges"

export type VacationRestrictionDay = "montag" | "dienstag" | "mittwoch" | "donnerstag" | "freitag"

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
  monthly_hours: number
  vacation_days_per_year: number
  employee_type: EmployeeType
  bundesland: string
  category: UserCategory | null
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
      vacation_days_per_year: 30,
    })
    .select()
    .single()

  if (error) throw error
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

export async function getOvertimeBalance(userId: string): Promise<number> {
  const supabase = await createClient()

  const { data: user } = await supabase.from("users").select("monthly_hours, bundesland").eq("id", userId).single()

  if (!user) return 0

  const monthlyTargetHours = user.monthly_hours || 173

  const { data: entries } = await supabase
    .from("time_entries")
    .select("date, hours")
    .eq("user_id", userId)
    .order("date")

  if (!entries || entries.length === 0) return 0

  const monthlyData = new Map<string, { actual: number; expected: number }>()

  entries.forEach((entry) => {
    const date = new Date(entry.date)
    const monthKey = format(date, "yyyy-MM")

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { actual: 0, expected: monthlyTargetHours })
    }
    const month = monthlyData.get(monthKey)!
    month.actual += Number(entry.hours)
  })

  let totalOvertime = 0
  monthlyData.forEach(({ actual, expected }) => {
    totalOvertime += actual - expected
  })

  return Math.round(totalOvertime * 100) / 100
}

export async function getMonthlyOvertime(userId: string, year: number, month: number): Promise<number> {
  const supabase = await createClient()

  const { data: user } = await supabase.from("users").select("monthly_hours").eq("id", userId).single()

  if (!user) return 0

  const monthlyTargetHours = user.monthly_hours || 173
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)

  const { data: entries } = await supabase
    .from("time_entries")
    .select("hours")
    .eq("user_id", userId)
    .gte("date", format(startDate, "yyyy-MM-dd"))
    .lte("date", format(endDate, "yyyy-MM-dd"))

  const actualHours = (entries || []).reduce((sum, e) => sum + Number(e.hours), 0)

  return Math.round((actualHours - monthlyTargetHours) * 100) / 100
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
