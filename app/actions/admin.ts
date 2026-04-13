"use server"

import { revalidatePath } from "next/cache"
import { getAllUsers, getAllTimeEntries, getUserById, type EmployeeType, type Weekday, type WeeklySchedule } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import type { Bundesland } from "@/lib/holidays"
import {
  getCurrentUserAccess,
  getUserPermissionMatrix,
  requirePermission,
  updateUserPermissionMatrix,
} from "@/lib/permissions-server"
import type { AccessProfile, AppPermission } from "@/lib/permissions"
import { canActorManageTargetTime, canActorViewTargetTime, filterUsersVisibleInAdmin } from "@/lib/visibility"

export async function checkIsAdmin(): Promise<boolean> {
  const access = await getCurrentUserAccess()
  return access.profile === "admin"
}

export async function getAdminDashboardData(startDate: string, endDate: string) {
  await requirePermission("users.view")

  const access = await getCurrentUserAccess()
  const actor = access.dbUser
  if (!actor) {
    throw new Error("Kein Zugriff")
  }

  const [allUsers, entries] = await Promise.all([getAllUsers(), getAllTimeEntries(startDate, endDate)])
  const users = filterUsersVisibleInAdmin(actor, allUsers, access)
  const visibleIds = new Set(users.map((u) => u.id))
  const filteredEntries = entries.filter((e) => visibleIds.has(e.user_id))

  const year = Number.parseInt(endDate.slice(0, 4), 10)
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const supabase = createClient()

  const { data: vacationAbsences, error: vacationError } = await supabase
    .from("absences")
    .select("user_id, days, status, type, start_date, end_date")
    .eq("type", "vacation")
    .in("status", ["approved", "pending"])
    .lte("start_date", yearEnd)
    .gte("end_date", yearStart)

  if (vacationError) throw vacationError

  const vacationByUser = new Map<string, { approved: number; pending: number }>()

  for (const absence of vacationAbsences || []) {
    const current = vacationByUser.get(absence.user_id) || { approved: 0, pending: 0 }
    const days = Number(absence.days) || 0
    if (absence.status === "approved") current.approved += days
    if (absence.status === "pending") current.pending += days
    vacationByUser.set(absence.user_id, current)
  }

  const userStats = users.map((user) => {
    const userEntries = filteredEntries.filter((entry) => entry.user_id === user.id)
    const totalHours = userEntries.reduce((sum, entry) => sum + Number(entry.hours), 0)
    const vacation = vacationByUser.get(user.id) || { approved: 0, pending: 0 }
    const yearlyTarget = Number(user.vacation_days_per_year || 30)
    const remainingVacationDays = Math.max(yearlyTarget - vacation.approved, 0)

    return {
      ...user,
      totalHours,
      entriesCount: userEntries.length,
      usedVacationDays: vacation.approved,
      pendingVacationDays: vacation.pending,
      remainingVacationDays,
    }
  })

  return {
    users: userStats,
    entries: filteredEntries,
    totalHours: filteredEntries.reduce((sum, entry) => sum + Number(entry.hours), 0),
    totalEntries: filteredEntries.length,
  }
}

export async function updateUserRole(userId: string, role: AccessProfile) {
  await requirePermission("admin.manage_permissions")

  const supabase = createClient()
  const { error } = await supabase.from("users").update({ role }).eq("id", userId)

  if (error) throw error
  return { success: true }
}

export async function getTimeEntriesForUserAdmin(userId: string, startDate: string, endDate: string) {
  const access = await getCurrentUserAccess()
  const actor = access.dbUser
  if (!actor) throw new Error("Kein Zugriff")

  const target = await getUserById(userId)
  if (!target) throw new Error("Benutzer nicht gefunden")
  if (!canActorViewTargetTime(actor, target, access)) {
    throw new Error("Kein Zugriff")
  }

  const supabase = createClient()
  const { data } = await supabase
    .from("time_entries")
    .select("*")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })

  return data || []
}

export async function updateTimeEntryAdmin(
  entryId: string,
  hours: number,
  description: string,
  project: string,
  projectId?: string,
) {
  const access = await getCurrentUserAccess()
  const actor = access.dbUser
  if (!actor) throw new Error("Kein Zugriff")

  const supabase = createClient()
  const { data: existing } = await supabase.from("time_entries").select("user_id").eq("id", entryId).single()
  if (!existing?.user_id) throw new Error("Eintrag nicht gefunden")

  const target = await getUserById(existing.user_id as string)
  if (!target || !canActorManageTargetTime(actor, target, access)) {
    throw new Error("Kein Zugriff")
  }

  const { error } = await supabase
    .from("time_entries")
    .update({
      hours,
      description: description || null,
      project: project || null,
      project_id: projectId || null,
    })
    .eq("id", entryId)

  if (error) throw error
  return { success: true }
}

export async function deleteTimeEntryAdmin(entryId: string) {
  const access = await getCurrentUserAccess()
  const actor = access.dbUser
  if (!actor) throw new Error("Kein Zugriff")

  const supabase = createClient()
  const { data: existing } = await supabase.from("time_entries").select("user_id").eq("id", entryId).single()
  if (!existing?.user_id) throw new Error("Eintrag nicht gefunden")

  const target = await getUserById(existing.user_id as string)
  if (!target || !canActorManageTargetTime(actor, target, access)) {
    throw new Error("Kein Zugriff")
  }

  const { error } = await supabase.from("time_entries").delete().eq("id", entryId)

  if (error) throw error
  return { success: true }
}

export async function updateUserWeeklyHours(userId: string, weeklyHours: number) {
  await requirePermission("users.manage_profile")

  if (weeklyHours < 0 || weeklyHours > 80) {
    throw new Error("Ungültige Wochenstunden")
  }

  const supabase = createClient()
  const { error } = await supabase.from("users").update({ weekly_hours: weeklyHours }).eq("id", userId)

  if (error) throw error
  return { success: true }
}

export async function updateUserWeeklySchedule(userId: string, weeklySchedule: WeeklySchedule) {
  await requirePermission("users.manage_profile")

  const sumHours = Object.values(weeklySchedule).reduce((sum, hours) => sum + hours, 0)
  if (sumHours < 0 || sumHours > 80) {
    throw new Error("Ungültige Wochenstunden")
  }

  for (const day of Object.values(weeklySchedule)) {
    if (day < 0 || day > 24) {
      throw new Error("Ungültige Tagesstunden")
    }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from("users")
    .update({ weekly_schedule: weeklySchedule, weekly_hours: sumHours })
    .eq("id", userId)

  if (error) {
    if (error.code === "PGRST204" && error.message?.includes("weekly_schedule")) {
      throw new Error(
        "Die Spalte weekly_schedule fehlt im aktuellen Supabase-Schema. Bitte führe die Datenbankmigration aus oder aktualisiere das Schema."
      )
    }
    throw error
  }
  return { success: true }
}

export async function updateUserMonthlyHours(userId: string, monthlyHours: number) {
  await requirePermission("users.manage_profile")

  if (monthlyHours < 0 || monthlyHours > 250) {
    throw new Error("Ungültige Monatsstunden (0-250)")
  }

  const supabase = createClient()
  const { error } = await supabase.from("users").update({ monthly_hours: monthlyHours }).eq("id", userId)

  if (error) throw error
  return { success: true }
}

export async function updateUserEmployeeType(userId: string, employeeType: EmployeeType, monthlyHours: number) {
  await requirePermission("users.manage_profile")

  const supabase = createClient()
  const { error } = await supabase
    .from("users")
    .update({ employee_type: employeeType, monthly_hours: monthlyHours })
    .eq("id", userId)

  if (error) throw error
  return { success: true }
}

export async function updateUserBundesland(userId: string, bundesland: Bundesland) {
  await requirePermission("users.manage_profile")

  const supabase = createClient()
  const { error } = await supabase.from("users").update({ bundesland }).eq("id", userId)

  if (error) throw error
  return { success: true }
}

export async function getUserClosedMonths(userId: string) {
  const access = await getCurrentUserAccess()
  const actor = access.dbUser
  if (!actor) throw new Error("Kein Zugriff")
  const target = await getUserById(userId)
  if (!target || !canActorViewTargetTime(actor, target, access)) {
    throw new Error("Kein Zugriff")
  }

  const supabase = createClient()
  const { data } = await supabase
    .from("month_closures")
    .select("*")
    .eq("user_id", userId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })

  return data || []
}

export async function deleteMonthClosure(closureId: string) {
  await requirePermission("time.manage_month_closures")

  const access = await getCurrentUserAccess()
  const actor = access.dbUser
  if (!actor) throw new Error("Kein Zugriff")

  const supabase = createClient()
  const { data: closure } = await supabase.from("month_closures").select("user_id").eq("id", closureId).single()
  if (!closure?.user_id) throw new Error("Eintrag nicht gefunden")

  const target = await getUserById(closure.user_id as string)
  if (!target || !canActorManageTargetTime(actor, target, access)) {
    throw new Error("Kein Zugriff")
  }

  const { error } = await supabase.from("month_closures").delete().eq("id", closureId)

  if (error) throw error
  return { success: true }
}

export async function fetchAllUsers() {
  await requirePermission("users.view")
  const access = await getCurrentUserAccess()
  const actor = access.dbUser
  if (!actor) return []
  return filterUsersVisibleInAdmin(actor, await getAllUsers(), access)
}

export async function updateUserCategory(userId: string, category: string) {
  await requirePermission("users.manage_profile")

  const supabase = createClient()
  const { error } = await supabase.from("users").update({ category }).eq("id", userId)
  if (error) throw new Error("Fehler beim Aktualisieren des Teams")

  revalidatePath("/admin")
}

export async function updateUserVacationDays(userId: string, vacationDaysPerYear: number) {
  await requirePermission("users.manage_profile")

  if (vacationDaysPerYear < 0 || vacationDaysPerYear > 60) {
    throw new Error("Ungültige Urlaubstage pro Jahr (0-60)")
  }

  const supabase = createClient()
  const { error } = await supabase
    .from("users")
    .update({ vacation_days_per_year: vacationDaysPerYear })
    .eq("id", userId)

  if (error) throw new Error("Fehler beim Aktualisieren der Urlaubstage")

  revalidatePath("/admin")
  revalidatePath("/urlaub")
}

export async function getUserAccessConfig(userId: string) {
  return getUserPermissionMatrix(userId)
}

export async function saveUserAccessConfig(params: {
  userId: string
  profile: AccessProfile
  permissions: Partial<Record<AppPermission, boolean>>
}) {
  return updateUserPermissionMatrix(params)
}
