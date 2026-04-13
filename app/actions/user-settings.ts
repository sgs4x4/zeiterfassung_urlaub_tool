"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { findOrCreateUser } from "@/lib/db"

export type NotificationSettings = {
  notifyVacationPending: boolean
  notifyVacationApproved: boolean
  notifyVacationRejected: boolean
  notifyVacationWithdrawn: boolean
}

export async function getMyNotificationSettings(): Promise<NotificationSettings> {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    throw new Error("Nicht angemeldet")
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  return {
    notifyVacationPending: user.notify_vacation_pending ?? true,
    notifyVacationApproved: user.notify_vacation_approved ?? true,
    notifyVacationRejected: user.notify_vacation_rejected ?? true,
    notifyVacationWithdrawn: user.notify_vacation_withdrawn ?? true,
  }
}

export async function updateMyNotificationSettings(input: NotificationSettings) {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    throw new Error("Nicht angemeldet")
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const supabase = await createClient()
  const { error } = await supabase
    .from("users")
    .update({
      notify_vacation_pending: !!input.notifyVacationPending,
      notify_vacation_approved: !!input.notifyVacationApproved,
      notify_vacation_rejected: !!input.notifyVacationRejected,
      notify_vacation_withdrawn: !!input.notifyVacationWithdrawn,
      // legacy column stays in sync for compatibility
      notify_vacation_status:
        !!input.notifyVacationPending ||
        !!input.notifyVacationApproved ||
        !!input.notifyVacationRejected ||
        !!input.notifyVacationWithdrawn,
    })
    .eq("id", user.id)

  if (error) {
    throw new Error(`Fehler beim Speichern: ${error.message}`)
  }

  revalidatePath("/settings")
  return { success: true }
}
