"use server"

import { revalidatePath } from "next/cache"
import { getAllUsers, getAllTimeEntries, type EmployeeType } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import type { Bundesland } from "@/lib/holidays"
import { getUserPermissionMatrix, requireAnyPermission, requirePermission, updateUserPermissionMatrix } from "@/lib/permissions-server"
import type { AccessProfile, AppPermission } from "@/lib/permissions"

export async function checkIsAdmin(): Promise<boolean> {
  try {
    await requireAnyPermission([
      "admin.manage_permissions",
      "users.manage_profile",
      "users.assign_projects",
      "time.manage_all_entries",
      "time.manage_projects",
      "vacation.manage_requests",
      "vacation.manage_blocked_days",
    ])
    return true
  } catch {
    return false
  }
}

export async function getAdminDashboardData(startDate: string, endDate: string) {
  await requirePermission("users.view")

  const [users, entries] = await Promise.all([getAllUsers(), getAllTimeEntries(startDate, endDate)])

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
    const userEntries = entries.filter((entry) => entry.user_id === user.id)
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
    entries,
    totalHours: entries.reduce((sum, entry) => sum + Number(entry.hours), 0),
    totalEntries: entries.length,
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
  await requirePermission("time.view_all_entries")

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
  await requirePermission("time.manage_all_entries")

  const supabase = createClient()
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
  await requirePermission("time.manage_all_entries")

  const supabase = createClient()
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
  await requirePermission("time.view_all_entries")

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

  const supabase = createClient()
  const { error } = await supabase.from("month_closures").delete().eq("id", closureId)

  if (error) throw error
  return { success: true }
}

export async function fetchAllUsers() {
  await requirePermission("users.view")
  return getAllUsers()
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
