export type AccessProfile = "employee" | "reporter" | "admin"

export type AppPermission =
  | "admin.access"
  | "admin.manage_permissions"
  | "users.view"
  | "users.manage_profile"
  | "users.assign_projects"
  | "time.view_all_entries"
  | "time.manage_all_entries"
  | "time.manage_month_closures"
  | "time.manage_projects"
  | "vacation.request_own"
  | "vacation.view_team_calendar"
  | "vacation.manage_requests"
  | "vacation.manage_blocked_days"

export type PermissionDefinition = {
  key: AppPermission
  label: string
  description: string
}

export type PermissionGroup = {
  key: "admin" | "users" | "time" | "vacation"
  label: string
  description: string
  permissions: PermissionDefinition[]
}

export type PermissionMap = Record<AppPermission, boolean>

export type DerivedPermissionFlags = {
  canAccessAdmin: boolean
  canAccessVacationModule: boolean
  canViewUserDirectory: boolean
  canManageUsers: boolean
  canAssignProjects: boolean
  canViewAllTimeEntries: boolean
  canManageAllTimeEntries: boolean
  canManageMonthClosures: boolean
  canManageProjects: boolean
  canViewTeamCalendar: boolean
  canManageVacationRequests: boolean
  canManageBlockedDays: boolean
  canManagePermissions: boolean
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "admin",
    label: "Adminbereich",
    description: "Navigation, Übersichten und Rechteverwaltung im Tool.",
    permissions: [
      {
        key: "admin.access",
        label: "Adminbereich öffnen",
        description: "Admin-Navigation und zentrale Übersichten im Tool sehen.",
      },
      {
        key: "admin.manage_permissions",
        label: "Rechte verwalten",
        description: "Zugriffsprofile und Einzelrechte anderer Benutzer pflegen.",
      },
    ],
  },
  {
    key: "users",
    label: "Mitarbeiter",
    description: "Mitarbeiterübersicht, Stammdaten und Projektzuordnungen.",
    permissions: [
      {
        key: "users.view",
        label: "Mitarbeiter sehen",
        description: "Mitarbeiterliste, Stundenstände und Urlaubssalden einsehen.",
      },
      {
        key: "users.manage_profile",
        label: "Stammdaten pflegen",
        description: "Team, Beschäftigung, Bundesland und Urlaubskontingent bearbeiten.",
      },
      {
        key: "users.assign_projects",
        label: "Projekte zuweisen",
        description: "Projektberechtigungen pro Mitarbeiter pflegen.",
      },
    ],
  },
  {
    key: "time",
    label: "Zeiterfassung",
    description: "Fremde Zeiteinträge, Monatsabschlüsse und Projekte.",
    permissions: [
      {
        key: "time.view_all_entries",
        label: "Alle Zeiteinträge sehen",
        description: "Zeiteinträge anderer Mitarbeiter einsehen.",
      },
      {
        key: "time.manage_all_entries",
        label: "Alle Zeiteinträge bearbeiten",
        description: "Zeiteinträge anderer Mitarbeiter anlegen, ändern und löschen.",
      },
      {
        key: "time.manage_month_closures",
        label: "Monatsabschlüsse verwalten",
        description: "Abgeschlossene Monate anderer Mitarbeiter wieder öffnen.",
      },
      {
        key: "time.manage_projects",
        label: "Projekte verwalten",
        description: "Projekte anlegen, bearbeiten und deaktivieren.",
      },
    ],
  },
  {
    key: "vacation",
    label: "Urlaub & Abwesenheiten",
    description: "Eigene Anträge, Teamkalender und Freigaben.",
    permissions: [
      {
        key: "vacation.request_own",
        label: "Eigene Abwesenheiten nutzen",
        description: "Eigene Urlaubs- und Abwesenheitsanträge erstellen und sehen.",
      },
      {
        key: "vacation.view_team_calendar",
        label: "Teamkalender sehen",
        description: "Abwesenheitsübersicht und Teamkalender einsehen.",
      },
      {
        key: "vacation.manage_requests",
        label: "Anträge bearbeiten",
        description: "Abwesenheitsanträge genehmigen, ablehnen und löschen.",
      },
      {
        key: "vacation.manage_blocked_days",
        label: "Sperrtage pflegen",
        description: "Gesperrte Tage im Teamkalender anlegen und entfernen.",
      },
    ],
  },
]

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.key))

export const DEFAULT_ROLE_PERMISSIONS: Record<AccessProfile, AppPermission[]> = {
  employee: ["vacation.request_own"],
  reporter: [
    "admin.access",
    "users.view",
    "time.view_all_entries",
    "vacation.request_own",
    "vacation.view_team_calendar",
  ],
  admin: [...ALL_PERMISSION_KEYS],
}

export function normalizeAccessProfile(profile?: string | null): AccessProfile {
  if (profile === "admin" || profile === "reporter" || profile === "employee") {
    return profile
  }

  return "employee"
}

export function createEmptyPermissionMap(): PermissionMap {
  return ALL_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = false
    return acc
  }, {} as PermissionMap)
}

export function buildPermissionMap(
  profile: AccessProfile,
  overrides: Partial<Record<AppPermission, boolean>> = {},
): PermissionMap {
  const permissionMap = createEmptyPermissionMap()

  for (const key of DEFAULT_ROLE_PERMISSIONS[profile]) {
    permissionMap[key] = true
  }

  for (const key of ALL_PERMISSION_KEYS) {
    if (typeof overrides[key] === "boolean") {
      permissionMap[key] = overrides[key] as boolean
    }
  }

  return permissionMap
}

export function getDerivedPermissionFlags(permissionMap: PermissionMap): DerivedPermissionFlags {
  const canManageUsers = permissionMap["users.manage_profile"]
  const canAssignProjects = permissionMap["users.assign_projects"]
  const canViewAllTimeEntries = permissionMap["time.view_all_entries"] || permissionMap["time.manage_all_entries"]
  const canManageAllTimeEntries = permissionMap["time.manage_all_entries"]
  const canManageMonthClosures = permissionMap["time.manage_month_closures"]
  const canManageProjects = permissionMap["time.manage_projects"]
  const canManagePermissions = permissionMap["admin.manage_permissions"]
  const canViewUserDirectory = permissionMap["users.view"] || canManageUsers || canAssignProjects || canManagePermissions
  const canViewTeamCalendar =
    permissionMap["vacation.view_team_calendar"] ||
    permissionMap["vacation.manage_requests"] ||
    permissionMap["vacation.manage_blocked_days"]
  const canManageVacationRequests = permissionMap["vacation.manage_requests"]
  const canManageBlockedDays = permissionMap["vacation.manage_blocked_days"]
  const canAccessVacationModule =
    permissionMap["vacation.request_own"] || canViewTeamCalendar || canManageVacationRequests || canManageBlockedDays
  const canAccessAdmin =
    permissionMap["admin.access"] ||
    canManagePermissions ||
    canViewUserDirectory ||
    canViewAllTimeEntries ||
    canManageProjects ||
    canViewTeamCalendar ||
    canManageVacationRequests ||
    canManageBlockedDays

  return {
    canAccessAdmin,
    canAccessVacationModule,
    canViewUserDirectory,
    canManageUsers,
    canAssignProjects,
    canViewAllTimeEntries,
    canManageAllTimeEntries,
    canManageMonthClosures,
    canManageProjects,
    canViewTeamCalendar,
    canManageVacationRequests,
    canManageBlockedDays,
    canManagePermissions,
  }
}

export function getLegacyHeaderFlags(profile: AccessProfile, permissionMap: PermissionMap) {
  const flags = getDerivedPermissionFlags(permissionMap)
  const isAdmin =
    profile === "admin" ||
    flags.canManagePermissions ||
    flags.canManageUsers ||
    flags.canAssignProjects ||
    flags.canManageAllTimeEntries ||
    flags.canManageMonthClosures ||
    flags.canManageProjects
  const isVacationAdmin = !isAdmin && (flags.canManageVacationRequests || flags.canManageBlockedDays)
  const isReporter = !isAdmin && !isVacationAdmin && flags.canAccessAdmin

  return {
    isAdmin,
    isReporter,
    canUseVacation: flags.canAccessVacationModule,
    isVacationAdmin,
  }
}
