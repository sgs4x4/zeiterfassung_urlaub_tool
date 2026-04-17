import type { User } from "@/lib/db"
import type { UserAccess } from "@/lib/permissions-server"

/**
 * Sichtbarkeit „von wem“: Team = gleiche users.category (Organisationseinheit im Tool).
 * Admin-Profil: uneingeschränkt, keine weitere Granularität.
 */

export function isAppAdminProfile(profile: UserAccess["profile"]): boolean {
  return profile === "admin"
}

export function canActorViewTargetTime(actor: User, target: User, access: UserAccess): boolean {
  if (target.id === actor.id) return true
  if (isAppAdminProfile(access.profile)) return true
  const p = access.permissions
  if (p["time.view_all_entries"] || p["time.manage_all_entries"]) return true
  if (p["time.view_team_entries"] || p["time.manage_team_entries"]) {
    if (actor.category == null || target.category == null) return false
    return actor.category === target.category
  }
  return false
}

export function canActorManageTargetTime(actor: User, target: User, access: UserAccess): boolean {
  if (target.id === actor.id) return false
  if (isAppAdminProfile(access.profile)) return true
  const p = access.permissions
  if (p["time.manage_all_entries"]) return true
  if (p["time.manage_team_entries"]) {
    if (actor.category == null || target.category == null) return false
    return actor.category === target.category
  }
  return false
}

/** Zeilen in der Admin-Mitarbeiterübersicht */
export function canViewUserInAdminList(actor: User, target: User, access: UserAccess): boolean {
  if (target.id === actor.id) return true
  if (isAppAdminProfile(access.profile)) return true
  if (access.canManageUsers || access.canAssignProjects || access.canManagePermissions) return true

  const hasFullTime =
    access.permissions["time.view_all_entries"] || access.permissions["time.manage_all_entries"]
  const hasTeamTime =
    access.permissions["time.view_team_entries"] || access.permissions["time.manage_team_entries"]

  if (hasTeamTime && !hasFullTime) {
    if (actor.category == null || target.category == null) return false
    return actor.category === target.category
  }

  if (access.permissions["users.view"]) return true

  return false
}

export function filterUsersVisibleInAdmin(actor: User, users: User[], access: UserAccess): User[] {
  return users.filter((u) => canViewUserInAdminList(actor, u, access))
}

export type VacationAbsenceCalendarScope = "all" | "team"

export function getVacationCalendarAbsenceScope(access: UserAccess): VacationAbsenceCalendarScope | null {
  if (isAppAdminProfile(access.profile)) return "all"
  const p = access.permissions
  if (
    p["vacation.manage_requests"] ||
    p["vacation.manage_blocked_days"] ||
    p["vacation.view_company_absences"] ||
    p["vacation.view_team_calendar"]
  ) {
    return "all"
  }
  return null
}
