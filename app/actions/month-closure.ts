"use server"

import { getServerSession } from "@/lib/auth"
import { findOrCreateUser, getMonthlyTargetHours } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { sendEmail, generateMonthClosureEmail } from "@/lib/email"
import { revalidatePath } from "next/cache"
import { differenceInDays, format, startOfMonth, endOfMonth, addMonths } from "date-fns"
import { de } from "date-fns/locale"

type NotificationSettings = {
  notify_vacation_status?: boolean
  notify_vacation_pending?: boolean
  notify_vacation_approved?: boolean
  notify_vacation_rejected?: boolean
  notify_vacation_withdrawn?: boolean
}

async function getAdminMonthClosureRecipients(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("users")
    .select(
      "email, notify_vacation_status, notify_vacation_pending, notify_vacation_approved, notify_vacation_rejected, notify_vacation_withdrawn"
    )
    .eq("role", "admin")

  if (error) {
    console.error("[month-closure] Fehler beim Laden von Admin-Emails:", error)
    return []
  }

  const recipients = (data || [])
    .filter((user: NotificationSettings & { email?: string }) => {
      const notifyStatus = user.notify_vacation_status !== false
      const anySpecificEnabled = [
        user.notify_vacation_pending,
        user.notify_vacation_approved,
        user.notify_vacation_rejected,
        user.notify_vacation_withdrawn,
      ].some((value) => value !== false)
      return Boolean(user.email) && notifyStatus && anySpecificEnabled
    })
    .map((user: { email: string }) => user.email?.toLowerCase())
    .filter(Boolean)

  return Array.from(new Set(recipients))
}

export async function canCloseMonth(year: number, month: number): Promise<boolean> {
  const today = new Date()
  const targetMonth = new Date(year, month - 1, 1)
  const lastDayOfMonth = endOfMonth(targetMonth)

  // Monat kann geschlossen werden wenn:
  // 1. Es ist der letzte Tag des Monats oder später (Monat ist vorbei)
  const daysSinceMonthEnd = differenceInDays(today, lastDayOfMonth)

  return daysSinceMonthEnd >= 0
}

export async function isMonthClosed(year: number, month: number): Promise<boolean> {
  const session = (await getServerSession()) as any
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    return false
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const supabase = await createClient()

  const { data } = await supabase
    .from("month_closures")
    .select("id")
    .eq("user_id", user.id)
    .eq("year", year)
    .eq("month", month)
    .single()

  return !!data
}

export type UnclosedMonth = {
  year: number
  month: number
  /** Tage seit Monatsende, >= 0 (nur bereits beendete Monate werden zurückgegeben). */
  daysOverdue: number
  /** Ab 7 Tagen überfällig muss der Abschluss erzwungen werden (siehe MonthClosureReminder). */
  isBlocking: boolean
}

/**
 * Alle vergangenen, bereits beendeten Monate des angemeldeten Nutzers, für die noch kein
 * Monatsabschluss existiert – sortiert vom ältesten zum neuesten. Anker ist der ERSTE erfasste
 * Zeiteintrag (nicht `users.created_at`): ein Account kann lange vor dem ersten tatsächlich
 * erfassten Monat angelegt worden sein (z.B. reine Admin-Accounts, Alt-/Testdaten) – ohne
 * jemals erfasste Zeit gibt es nichts abzuschließen. Hat ein Nutzer noch nie Zeit erfasst, wird
 * eine leere Liste zurückgegeben. Monate werden unabhängig davon zurückgegeben, ob in ihnen
 * überhaupt Zeit erfasst wurde (solange sie NACH dem ersten Eintrag liegen), da ein Monat auch
 * mit 0 Stunden bewusst abgeschlossen werden muss (z.B. durchgehend Urlaub/Krankheit).
 */
export async function getMyUnclosedMonths(): Promise<UnclosedMonth[]> {
  const session = (await getServerSession()) as any
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    return []
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const supabase = await createClient()

  const [{ data: closures }, { data: firstEntry }] = await Promise.all([
    supabase.from("month_closures").select("year, month").eq("user_id", user.id),
    supabase.from("time_entries").select("date").eq("user_id", user.id).order("date", { ascending: true }).limit(1).maybeSingle(),
  ])

  if (!firstEntry) {
    return []
  }

  const closedKeys = new Set((closures || []).map((c) => `${c.year}-${c.month}`))

  const today = new Date()
  const result: UnclosedMonth[] = []
  let cursor = startOfMonth(new Date(firstEntry.date))

  while (endOfMonth(cursor) <= today) {
    const year = cursor.getFullYear()
    const month = cursor.getMonth() + 1

    if (!closedKeys.has(`${year}-${month}`)) {
      const daysOverdue = differenceInDays(today, endOfMonth(cursor))
      result.push({ year, month, daysOverdue, isBlocking: daysOverdue >= 7 })
    }

    cursor = addMonths(cursor, 1)
  }

  return result
}

/** Stunden-Zusammenfassung eines einzelnen Monats für die Vorschau im Abschluss-Reminder. */
export async function getMonthClosureSummary(year: number, month: number) {
  const session = (await getServerSession()) as any
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    throw new Error("Nicht angemeldet")
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const supabase = await createClient()

  const startDate = format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd")
  const endDate = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd")

  const { data: entries } = await supabase
    .from("time_entries")
    .select("hours")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate)

  const totalHours = (entries || []).reduce((sum, e) => sum + Number(e.hours), 0)
  const expectedHours = await getMonthlyTargetHours(user.id, year, month, user.monthly_hours || 173)

  return {
    totalHours,
    expectedHours,
    overtime: Math.round((totalHours - expectedHours) * 100) / 100,
    entriesCount: (entries || []).length,
  }
}

export async function closeMonth(year: number, month: number) {
  const session = (await getServerSession()) as any
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    throw new Error("Nicht angemeldet")
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)

  // Prüfen ob Monat geschlossen werden darf
  const canClose = await canCloseMonth(year, month)
  if (!canClose) {
    throw new Error("Monat kann nur nach Monatsende geschlossen werden")
  }

  // Prüfen ob bereits geschlossen
  const alreadyClosed = await isMonthClosed(year, month)
  if (alreadyClosed) {
    throw new Error("Monat wurde bereits geschlossen")
  }

  const supabase = await createClient()

  // Zeiteinträge für den Monat abrufen
  const startDate = format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd")
  const endDate = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd")

  const { data: entries } = await supabase
    .from("time_entries")
    .select("*, projects(name, color)")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })

  const totalHours = entries?.reduce((sum, e) => sum + Number(e.hours), 0) || 0
  // Soll aus der Arbeitsverhältnis-Historie für GENAU diesen Monat auflösen, statt den
  // aktuellen users.monthly_hours-Wert zu nehmen – der kann inzwischen (z.B. bei später
  // abgeschlossenen Monaten) schon wieder geändert worden sein.
  const expectedHours = await getMonthlyTargetHours(user.id, year, month, user.monthly_hours || 173)
  const overtime = totalHours - expectedHours

  // Monatsabschluss speichern
  const { error: closureError } = await supabase.from("month_closures").insert({
    user_id: user.id,
    year,
    month,
    total_hours: totalHours,
    expected_hours: expectedHours,
    overtime,
  })

  if (closureError) {
    throw new Error("Fehler beim Abschließen des Monats")
  }

  // Einträge für Email formatieren
  const formattedEntries =
    entries?.map((e) => ({
      date: format(new Date(e.date), "dd.MM.yyyy"),
      hours: Number(e.hours),
      projectName: e.projects?.name,
      description: e.description,
      start_time: e.start_time,
      end_time: e.end_time,
    })) || []

  const monthName = format(new Date(year, month - 1), "MMMM yyyy", { locale: de })
  const emailHtml = generateMonthClosureEmail(
    user.name,
    user.email,
    monthName,
    totalHours,
    expectedHours,
    overtime,
    formattedEntries,
  )

  const adminEmails = await getAdminMonthClosureRecipients()

  if (adminEmails.length === 0) {
    console.log("[Monatsabschluss] Keine Admin-Empfänger mit aktivierten Benachrichtigungen gefunden")
  } else {
    try {
      await sendEmail({
        to: adminEmails,
        subject: `Monatsabschluss ${monthName} - ${user.name}`,
        html: emailHtml,
      })
      console.log(`[Monatsabschluss] Email an ${adminEmails.length} Admin-Empfänger gesendet`)
    } catch (emailError) {
      console.error("[Monatsabschluss] Email-Fehler:", emailError)
      // Fehler beim Email-Versand sollte den Abschluss nicht verhindern
    }
  }

  revalidatePath("/dashboard")

  return {
    success: true,
    message: `Monat ${monthName} erfolgreich geschlossen`,
    emailRecipients: adminEmails.length,
  }
}

