"use server"

import { getServerSession } from "@/lib/auth"
import {
  findOrCreateUser,
  getUserById,
  createTimeEntry,
  updateTimeEntry,
  getTimeEntriesForUser,
  deleteTimeEntry,
  getWeeklyHours,
  getOvertimeBalance as calcOvertime,
  getMonthlyOvertime,
  calculateHoursFromTimes,
} from "@/lib/db"
import { revalidatePath } from "next/cache"
import { differenceInDays } from "date-fns"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUserAccess } from "@/lib/permissions-server"
import { canActorManageTargetTime } from "@/lib/visibility"

export async function getCurrentUser() {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    return null
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  return user
}

export async function saveTimeEntry(formData: FormData) {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    throw new Error("Nicht angemeldet")
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const access = await getCurrentUserAccess()

  const date = formData.get("date") as string
  const description = (formData.get("description") as string) || null
  const projectId = (formData.get("project_id") as string) || null
  const entryId = formData.get("entry_id") as string | null

  const startTime = (formData.get("start_time") as string) || null
  const endTime = (formData.get("end_time") as string) || null

  // Stunden entweder aus Formular oder berechnen
  let hours: number
  if (startTime && endTime) {
    hours = calculateHoursFromTimes(startTime, endTime)
  } else {
    hours = Number.parseFloat(formData.get("hours") as string)
  }

  if (!date || isNaN(hours) || hours < 0 || hours > 24) {
    throw new Error("Ungültige Eingabe")
  }

  if (!access.canManageAllTimeEntries) {
    const entryDate = new Date(date)
    const today = new Date()
    const daysDifference = differenceInDays(today, entryDate)

    if (daysDifference > 5) {
      throw new Error("Einträge können nur maximal 5 Tage rückwirkend bearbeitet werden")
    }
  }

  const entryDate = new Date(date)
  const { isMonthClosed } = await import("./month-closure")
  const monthClosed = await isMonthClosed(entryDate.getFullYear(), entryDate.getMonth() + 1)

  if (monthClosed && !access.canManageAllTimeEntries) {
    throw new Error("Dieser Monat wurde bereits abgeschlossen und kann nicht mehr bearbeitet werden")
  }

  if (entryId) {
    await updateTimeEntry(entryId, hours, description, projectId, startTime, endTime)
  } else {
    await createTimeEntry(user.id, date, hours, description, projectId, startTime, endTime)
  }

  revalidatePath("/dashboard")

  return { success: true }
}

export async function removeTimeEntry(entryId: string) {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    throw new Error("Nicht angemeldet")
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const access = await getCurrentUserAccess()
  const supabase = await createClient()
  const { data: entryRow } = await supabase.from("time_entries").select("user_id, date").eq("id", entryId).single()

  if (!entryRow) {
    throw new Error("Eintrag nicht gefunden")
  }

  const entryUserId = entryRow.user_id as string
  const isOwnEntry = entryUserId === user.id

  if (!isOwnEntry) {
    const target = await getUserById(entryUserId)
    if (!target || !canActorManageTargetTime(user, target, access)) {
      throw new Error("Kein Zugriff")
    }
  } else if (!access.canManageAllTimeEntries) {
    const entryDate = new Date(entryRow.date as string)

    const { isMonthClosed } = await import("./month-closure")
    const monthClosed = await isMonthClosed(entryDate.getFullYear(), entryDate.getMonth() + 1)

    if (monthClosed) {
      throw new Error("Dieser Monat wurde bereits abgeschlossen und Einträge können nicht mehr gelöscht werden")
    }

    const today = new Date()
    const daysDifference = differenceInDays(today, entryDate)

    if (daysDifference > 5) {
      throw new Error("Einträge können nur maximal 5 Tage rückwirkend gelöscht werden")
    }
  }

  await deleteTimeEntry(entryId, entryUserId)
  revalidatePath("/dashboard")

  return { success: true }
}

export async function getMyTimeEntries(startDate: string, endDate: string) {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    return []
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  return getTimeEntriesForUser(user.id, startDate, endDate)
}

export async function getMyWeeklyHours(weekStart: string, weekEnd: string) {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    return 0
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  return getWeeklyHours(user.id, weekStart, weekEnd)
}

export async function getOvertimeBalance() {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    return 0
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  return calcOvertime(user.id)
}

export async function getMonthlyOvertimeData(year: number, month: number) {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    return 0
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  return getMonthlyOvertime(user.id, year, month)
}

export async function saveTimeEntryForUser(targetUserId: string, formData: FormData) {
  const session = await getServerSession()
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    throw new Error("Nicht angemeldet")
  }

  const actor = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const access = await getCurrentUserAccess()
  const target = await getUserById(targetUserId)
  if (!target || !canActorManageTargetTime(actor, target, access)) {
    throw new Error("Kein Zugriff")
  }

  const date = formData.get("date") as string
  const description = (formData.get("description") as string) || null
  const projectId = (formData.get("project_id") as string) || null
  const entryId = formData.get("entry_id") as string | null
  const startTime = (formData.get("start_time") as string) || null
  const endTime = (formData.get("end_time") as string) || null

  let hours: number
  if (startTime && endTime) {
    hours = calculateHoursFromTimes(startTime, endTime)
  } else {
    hours = Number.parseFloat(formData.get("hours") as string)
  }

  if (!date || isNaN(hours) || hours < 0 || hours > 24) {
    throw new Error("Ungültige Eingabe")
  }

  if (entryId) {
    await updateTimeEntry(entryId, hours, description, projectId, startTime, endTime)
  } else {
    await createTimeEntry(targetUserId, date, hours, description, projectId, startTime, endTime)
  }

  revalidatePath("/admin")
  return { success: true }
}
