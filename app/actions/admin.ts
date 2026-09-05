"use server"

import { revalidatePath } from "next/cache"
import { format } from "date-fns"
import {
  getAllUsers,
  getAllTimeEntries,
  getUserById,
  getOvertimeBalance,
  setUserEmploymentTerms,
  type EmployeeType,
  type WeeklySchedule,
} from "@/lib/db"
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

function assertMonthlyWeeklyConsistency(monthlyHours: number, weeklyHours: number) {
  if (monthlyHours < 0 || weeklyHours < 0) {
    throw new Error("Ungültige Sollstunden")
  }

  if (weeklyHours === 0) {
    if (monthlyHours !== 0) {
      throw new Error("Bei 0 Wochenstunden müssen die Monatsstunden ebenfalls 0 sein.")
    }
    return
  }

  const minMonthly = weeklyHours * 4
  const maxMonthly = weeklyHours * 5

  if (monthlyHours < minMonthly || monthlyHours > maxMonthly) {
    throw new Error(
      `Monatsstunden passen nicht zum Wochenplan. Bei ${weeklyHours.toFixed(2)} Wochenstunden sind ${minMonthly.toFixed(2)} bis ${maxMonthly.toFixed(2)} Monatsstunden plausibel.`
    )
  }
}

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

  // Kumulierter Überstunden-Saldo je Mitarbeiter (unabhängig vom gewählten Filterzeitraum,
  // wie auf dem eigenen Dashboard). Parallelisiert, da getOvertimeBalance() pro Nutzer die
  // komplette Zeiteintrags-Historie gegen die Arbeitsverhältnis-Historie auflöst; bei sehr
  // vielen Mitarbeitenden könnte das später durch eine einzelne aggregierte Query ersetzt
  // werden, für die üblichen Teamgrößen ist der parallele Rundlauf aber unproblematisch.
  const overtimeByUser = new Map<string, number>(
    await Promise.all(users.map(async (user) => [user.id, await getOvertimeBalance(user.id)] as const)),
  )

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
      overtimeBalance: overtimeByUser.get(user.id) ?? 0,
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

/**
 * Einziger Weg, das Arbeitsverhältnis eines Nutzers zu ändern (Beschäftigungsart,
 * Monatsstunden-Soll, Wochenplan). Ersetzt die früheren getrennten Aktionen
 * (updateUserWeeklyHours/-MonthlyHours/-EmployeeType/-WeeklySchedule), die users.* direkt
 * überschrieben haben und dadurch Überstunden-/Sollstunden-Berechnungen für VERGANGENE Monate
 * rückwirkend verfälscht haben, sobald sich ein Vertrag änderte.
 *
 * Schreibt stattdessen über setUserEmploymentTerms() einen neuen, historisierten Zeitraum
 * (Tabelle user_employment_terms) – siehe scripts/019_user_employment_terms.sql. Ein
 * `effectiveFrom`-Datum in der Vergangenheit erlaubt eine rückwirkende Korrektur (z.B. "der
 * neue Vertrag galt eigentlich schon ab dem 1. des Monats"); ein Datum in der Zukunft wird
 * abgelehnt, weil dafür aktuell kein Mechanismus existiert, der den denormalisierten
 * "aktuellen Stand" auf users.* automatisch zum Stichtag nachzieht.
 */
export async function updateUserEmployment(
  userId: string,
  params: {
    employeeType: EmployeeType
    monthlyHours: number
    weeklySchedule: WeeklySchedule
    /** yyyy-MM-dd, Default: heute */
    effectiveFrom?: string
  },
) {
  const access = await requirePermission("users.manage_profile")
  const actor = access.dbUser

  const normalizedSchedule = Object.entries(params.weeklySchedule).reduce((acc, [day, value]) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
      throw new Error("Ungültige Tagesstunden")
    }
    return { ...acc, [day]: numericValue }
  }, {} as WeeklySchedule)

  for (const day of Object.values(normalizedSchedule)) {
    if (day < 0 || day > 24) {
      throw new Error("Ungültige Tagesstunden")
    }
  }

  const weeklyHours = Object.values(normalizedSchedule).reduce((sum, hours) => sum + hours, 0)
  if (weeklyHours < 0 || weeklyHours > 80) {
    throw new Error("Ungültige Wochenstunden")
  }

  if (params.monthlyHours < 0 || params.monthlyHours > 250) {
    throw new Error("Ungültige Monatsstunden (0-250)")
  }

  assertMonthlyWeeklyConsistency(params.monthlyHours, weeklyHours)

  const today = format(new Date(), "yyyy-MM-dd")
  const effectiveFrom = params.effectiveFrom || today
  if (effectiveFrom > today) {
    throw new Error(
      "Ein für die Zukunft geplanter Wechsel wird aktuell nicht unterstützt. Bitte das Gültig-ab-Datum auf heute oder einen Tag in der Vergangenheit setzen.",
    )
  }

  await setUserEmploymentTerms(
    userId,
    {
      employeeType: params.employeeType,
      monthlyHours: params.monthlyHours,
      weeklyHours,
      weeklySchedule: normalizedSchedule,
    },
    effectiveFrom,
    actor?.id ?? null,
  )

  revalidatePath("/admin")
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

/** Kumulierter Überstunden-Saldo eines Mitarbeiters für die Admin-Detailansicht (/admin/users/[id]/entries). */
export async function getAdminOvertimeBalance(userId: string): Promise<number> {
  const access = await getCurrentUserAccess()
  const actor = access.dbUser
  if (!actor) throw new Error("Kein Zugriff")
  const target = await getUserById(userId)
  if (!target || !canActorViewTargetTime(actor, target, access)) {
    throw new Error("Kein Zugriff")
  }

  return getOvertimeBalance(userId)
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

/**
 * "Überstunden-Basis" eines Mitarbeiters: ab wann Monate für den Überstunden-Saldo zählen
 * (`overtime_tracking_start_date`) und ein optionaler manueller Start-Saldo
 * (`overtime_baseline_hours`, z.B. übernommen aus einem Vorgängersystem). Siehe
 * scripts/020_overtime_tracking_start.sql und getOvertimeBalance in lib/db.ts – ohne diese
 * Grenze werden Monate von VOR dem Tool-Rollout fälschlich als große Fehlstunden gerechnet.
 */
export async function updateUserOvertimeBaseline(
  userId: string,
  params: { trackingStartDate: string; baselineHours: number },
) {
  await requirePermission("users.manage_profile")

  if (!params.trackingStartDate || Number.isNaN(new Date(params.trackingStartDate).getTime())) {
    throw new Error("Ungültiges Datum")
  }
  if (!Number.isFinite(params.baselineHours)) {
    throw new Error("Ungültiger Start-Saldo")
  }

  const supabase = createClient()
  const { error } = await supabase
    .from("users")
    .update({
      overtime_tracking_start_date: params.trackingStartDate,
      overtime_baseline_hours: params.baselineHours,
    })
    .eq("id", userId)

  if (error) throw new Error("Fehler beim Aktualisieren der Überstunden-Basis")

  revalidatePath("/admin")
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
