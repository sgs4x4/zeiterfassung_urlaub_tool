import "server-only"

import { revalidatePath } from "next/cache"
import { getServerSession } from "@/lib/auth"
import { findOrCreateUser, getUserByEmail, type User } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import {
  ALL_PERMISSION_KEYS,
  buildPermissionMap,
  getDerivedPermissionFlags,
  normalizeAccessProfile,
  PERMISSION_GROUPS,
  type AccessProfile,
  type AppPermission,
  type PermissionMap,
} from "@/lib/permissions"

export type UserAccess = {
  dbUser: User | null
  profile: AccessProfile
  permissions: PermissionMap
  grantedPermissions: AppPermission[]
} & ReturnType<typeof getDerivedPermissionFlags>

function buildUserAccess(dbUser: User | null, profile: AccessProfile, permissions: PermissionMap): UserAccess {
  return {
    dbUser,
    profile,
    permissions,
    grantedPermissions: ALL_PERMISSION_KEYS.filter((key) => permissions[key]),
    ...getDerivedPermissionFlags(permissions),
  }
}

async function getPermissionOverrides(userId: string): Promise<Partial<Record<AppPermission, boolean>>> {
  const supabase = createClient()
  const { data, error } = await supabase.from("user_permissions").select("permission_key, is_allowed").eq("user_id", userId)

  if (error) {
    console.warn("[permissions] Fallback auf Rollenprofil:", error.message)
    return {}
  }

  const overrides: Partial<Record<AppPermission, boolean>> = {}

  for (const row of data || []) {
    const permissionKey = row.permission_key as AppPermission
    if (ALL_PERMISSION_KEYS.includes(permissionKey)) {
      overrides[permissionKey] = !!row.is_allowed
    }
  }

  return overrides
}

export async function resolveUserAccess(dbUser: User | null): Promise<UserAccess> {
  const profile = normalizeAccessProfile(dbUser?.role)

  if (!dbUser) {
    const permissions = buildPermissionMap(profile)
    return buildUserAccess(null, profile, permissions)
  }

  const overrides = await getPermissionOverrides(dbUser.id)
  const permissions = buildPermissionMap(profile, overrides)
  return buildUserAccess(dbUser, profile, permissions)
}

export async function getCurrentUserAccess(): Promise<UserAccess> {
  const session = await getServerSession()

  if (!session?.user?.email) {
    return resolveUserAccess(null)
  }

  let dbUser = await getUserByEmail(session.user.email)

  if (!dbUser && session.user.id && session.user.name) {
    dbUser = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  }

  return resolveUserAccess(dbUser)
}

export async function requirePermission(permission: AppPermission) {
  const access = await getCurrentUserAccess()
  if (!access.permissions[permission]) {
    throw new Error("Kein Zugriff")
  }

  return access
}

export async function requireAnyPermission(permissions: AppPermission[]) {
  const access = await getCurrentUserAccess()
  if (!permissions.some((permission) => access.permissions[permission])) {
    throw new Error("Kein Zugriff")
  }

  return access
}

export async function getUserPermissionMatrix(userId: string) {
  await requirePermission("admin.manage_permissions")

  const supabase = createClient()
  const { data: user, error } = await supabase.from("users").select("*").eq("id", userId).single()

  if (error || !user) {
    throw new Error("Benutzer nicht gefunden")
  }

  const profile = normalizeAccessProfile(user.role)
  const overrides = await getPermissionOverrides(userId)
  const permissions = buildPermissionMap(profile, overrides)
  const defaults = buildPermissionMap(profile)

  return {
    user,
    profile,
    permissions,
    defaults,
    groups: PERMISSION_GROUPS,
  }
}

export async function updateUserPermissionMatrix(params: {
  userId: string
  profile: AccessProfile
  permissions: Partial<Record<AppPermission, boolean>>
}) {
  const access = await requirePermission("admin.manage_permissions")
  const supabase = createClient()
  const profile = normalizeAccessProfile(params.profile)

  const { error: roleError } = await supabase.from("users").update({ role: profile }).eq("id", params.userId)
  if (roleError) {
    throw new Error(`Fehler beim Speichern des Profils: ${roleError.message}`)
  }

  const { error: deleteError } = await supabase.from("user_permissions").delete().eq("user_id", params.userId)
  if (deleteError) {
    if (deleteError.message.toLowerCase().includes("user_permissions")) {
      throw new Error("Die Rechte-Migration fehlt. Bitte zuerst scripts/014_internal_permissions.sql ausführen.")
    }
    throw new Error(`Fehler beim Zurücksetzen der Rechte: ${deleteError.message}`)
  }

  if (profile === "admin") {
    revalidatePath("/admin")
    revalidatePath("/admin/projects")
    revalidatePath("/admin/team-calendar")
    revalidatePath("/admin/vacation-requests")
    revalidatePath("/dashboard")
    revalidatePath("/urlaub")
    revalidatePath("/urlaub/team")
    return { success: true }
  }

  const desiredPermissions = buildPermissionMap(profile, params.permissions)
  const defaultPermissions = buildPermissionMap(profile)

  const overrides = ALL_PERMISSION_KEYS.flatMap((key) => {
    if (desiredPermissions[key] === defaultPermissions[key]) {
      return []
    }

    return [
      {
        user_id: params.userId,
        permission_key: key,
        is_allowed: desiredPermissions[key],
        updated_by: access.dbUser?.id ?? null,
      },
    ]
  })

  if (overrides.length > 0) {
    const { error: insertError } = await supabase.from("user_permissions").insert(overrides)
    if (insertError) {
      if (insertError.message.toLowerCase().includes("user_permissions")) {
        throw new Error("Die Rechte-Migration fehlt. Bitte zuerst scripts/014_internal_permissions.sql ausführen.")
      }
      throw new Error(`Fehler beim Speichern der Rechte: ${insertError.message}`)
    }
  }

  revalidatePath("/admin")
  revalidatePath("/admin/projects")
  revalidatePath("/admin/team-calendar")
  revalidatePath("/admin/vacation-requests")
  revalidatePath("/dashboard")
  revalidatePath("/urlaub")
  revalidatePath("/urlaub/team")

  return { success: true }
}
