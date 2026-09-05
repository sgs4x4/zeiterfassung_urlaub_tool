import "server-only"

import { createClient } from "@/lib/supabase/server"
import { getCurrentUserAccess } from "@/lib/permissions-server"

/**
 * Protokollierung administrativer Eingriffe (siehe scripts/024_audit_log.sql).
 *
 * Bewusste Designentscheidung: Ein Fehler beim Protokollieren bricht die eigentliche Aktion NICHT
 * ab, sondern wird nur geloggt. Andernfalls würde ein Problem mit der Protokolltabelle die
 * gesamte Zeiterfassung lahmlegen. Umgekehrt gilt: Die Protokollzeile wird erst NACH der
 * erfolgreichen Änderung geschrieben, damit nichts protokolliert wird, was gar nicht passiert ist.
 */

export type AuditAction =
  | "time_entry.create"
  | "time_entry.update"
  | "time_entry.delete"
  | "month_closure.delete"
  | "overtime.adjustment.create"
  | "overtime.adjustment.delete"
  | "overtime.tracking_start.update"
  | "employment.update"
  | "permissions.update"
  | "user.role.update"
  | "user.vacation_days.update"
  | "absence.create_for_user"
  | "absence.status.update"

export async function recordAudit(params: {
  action: AuditAction
  targetUserId?: string | null
  entityType?: string | null
  entityId?: string | null
  before?: unknown
  after?: unknown
}): Promise<void> {
  try {
    const access = await getCurrentUserAccess()
    const actor = access.dbUser
    const supabase = createClient()

    const { error } = await supabase.from("audit_log").insert({
      actor_id: actor?.id ?? null,
      actor_name: actor?.name ?? null,
      actor_email: actor?.email ?? null,
      target_user_id: params.targetUserId ?? null,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      before_data: params.before ?? null,
      after_data: params.after ?? null,
    })

    if (error) {
      console.error("[audit] Protokolleintrag fehlgeschlagen:", params.action, error.message)
    }
  } catch (error) {
    console.error("[audit] Protokolleintrag fehlgeschlagen:", params.action, error)
  }
}
