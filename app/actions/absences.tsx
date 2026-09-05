"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getServerSession } from "@/lib/auth"
import {
  findOrCreateUser,
  getUserByEmail,
  getOvertimeBalance,
  getScheduledHoursForRange,
  isVacationAllowedForCategory,
  USER_CATEGORY_LABELS,
} from "@/lib/db"
import { eachDayOfInterval, isWeekend } from "date-fns"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import { sendEmail } from "@/lib/email"
import { getCurrentUserAccess, requirePermission } from "@/lib/permissions-server"
import { getVacationCalendarAbsenceScope } from "@/lib/visibility"
import { getHolidaysForYear } from "@/app/actions/holidays"
import { recordAudit } from "@/lib/audit"
// Konstanten/Typen liegen in lib/absence-types.ts: "use server"-Dateien dürfen ausschließlich
// async Funktionen exportieren.
import {
  ABSENCE_TYPE_LABELS,
  HALF_DAY_ABSENCE_TYPES as HALF_DAY_TYPES,
  type AbsenceType,
} from "@/lib/absence-types"
import type { Bundesland } from "@/lib/holidays"

const ADMIN_EMAILS = [
  "clemens.rau@sgs4x4.de",
  "cedric.thielecke@sgs4x4.de",
  "Christoph.Thielecke@sgs4x4.de",
]

export type Absence = {
  id: string
  user_id: string
  type: AbsenceType
  start_date: string
  end_date: string
  days: number
  day_part?: "full" | "half_am" | "half_pm"
  reason: string | null
  status: "pending" | "approved" | "rejected"
  created_at: string
  user?: { name: string; email: string }
}

export type BlockedDay = {
  id: string
  date: string
  reason: string | null
  category: string | null
}

function isBlockedDayApplicableToUser(blockedDay: BlockedDay, userCategory: string | null): boolean {
  // Wenn kein category angegeben, blockiert es für ALLE
  if (!blockedDay.category) return true
  
  // Sonst: check ob userCategory in der komma-separierten Liste vorkommt
  const blockedCategories = blockedDay.category.split(",").map((c) => c.trim())
  return userCategory ? blockedCategories.includes(userCategory) : false
}

function parseIsoDateLocal(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Date(year, month - 1, day)
}

async function countVacationDaysExcludingHolidays(
  startDate: string,
  endDate: string,
  bundesland: Bundesland,
): Promise<number> {
  const start = parseIsoDateLocal(startDate)
  const end = parseIsoDateLocal(endDate)
  const startYear = start.getFullYear()
  const endYear = end.getFullYear()
  const years: number[] = []
  for (let y = startYear; y <= endYear; y++) years.push(y)

  const holidays = (await Promise.all(years.map((year) => getHolidaysForYear(year, bundesland)))).flat()
  const holidayDates = new Set(holidays.map((h) => h.date))
  const days = eachDayOfInterval({ start, end })

  return days.filter((d) => {
    if (isWeekend(d)) return false
    const dateStr = format(d, "yyyy-MM-dd")
    return !holidayDates.has(dateStr)
  }).length
}

type VacationEmailStatus = "pending" | "approved" | "rejected" | "withdrawn"

async function getRecipientsForVacationStatusEmails(
  recipients: string[],
  status: VacationEmailStatus,
): Promise<string[]> {
  const uniqueRecipients = [...new Set(recipients.filter(Boolean))]
  if (uniqueRecipients.length === 0) return []

  const supabase = await createClient()
  const { data: users } = await supabase
    .from("users")
    .select(
      "email, notify_vacation_status, notify_vacation_pending, notify_vacation_approved, notify_vacation_rejected, notify_vacation_withdrawn",
    )
    .in("email", uniqueRecipients)

  const preferenceMap = new Map<string, { legacy: boolean; pending: boolean; approved: boolean; rejected: boolean; withdrawn: boolean }>()
  for (const user of users || []) {
    preferenceMap.set(String(user.email).toLowerCase(), {
      legacy: user.notify_vacation_status !== false,
      pending: user.notify_vacation_pending !== false,
      approved: user.notify_vacation_approved !== false,
      rejected: user.notify_vacation_rejected !== false,
      withdrawn: user.notify_vacation_withdrawn !== false,
    })
  }

  return uniqueRecipients.filter((email) => {
    const key = email.toLowerCase()
    if (!preferenceMap.has(key)) return true
    const pref = preferenceMap.get(key)!
    if (status === "pending") return pref.pending && pref.legacy
    if (status === "approved") return pref.approved && pref.legacy
    if (status === "rejected") return pref.rejected && pref.legacy
    return pref.withdrawn && pref.legacy
  })
}

function getMonthDateRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  return { start, end }
}

async function hasVacationAdminAccess(session: any): Promise<boolean> {
  const access = await getCurrentUserAccess()
  return access.canManageVacationRequests || access.canManageBlockedDays
}

function getAbsenceTypeLabel(type: Absence["type"]) {
  return ABSENCE_TYPE_LABELS[type]
}

function getDayPartLabel(dayPart?: Absence["day_part"]) {
  if (!dayPart || dayPart === "full") return "Ganztag"
  if (dayPart === "half_am") return "Halbtag (Vormittag)"
  return "Halbtag (Nachmittag)"
}

async function sendStatusChangeEmails(params: {
  absence: Absence
  employeeName: string
  employeeEmail: string
  actorName: string
  status: "approved" | "rejected"
}) {
  const { absence, employeeName, employeeEmail, actorName, status } = params
  const statusLabel = status === "approved" ? "genehmigt" : "abgelehnt"
  const statusTitle = status === "approved" ? "Genehmigt" : "Abgelehnt"

  const start = format(new Date(absence.start_date), "dd.MM.yyyy", { locale: de })
  const end = format(new Date(absence.end_date), "dd.MM.yyyy", { locale: de })

  const recipients = await getRecipientsForVacationStatusEmails([employeeEmail, ...ADMIN_EMAILS], status)
  if (recipients.length === 0) {
    return
  }

  await sendEmail({
    to: recipients,
    subject: `Abwesenheitsantrag ${statusTitle}: ${employeeName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2>Antrag ${statusLabel}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px;color:#666;">Mitarbeiter</td><td style="padding:8px;font-weight:bold;">${employeeName} (${employeeEmail})</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;color:#666;">Typ</td><td style="padding:8px;">${getAbsenceTypeLabel(absence.type)}</td></tr>
          <tr><td style="padding:8px;color:#666;">Zeitraum</td><td style="padding:8px;">${start} – ${end}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;color:#666;">Umfang</td><td style="padding:8px;">${getDayPartLabel(absence.day_part)}</td></tr>
          <tr><td style="padding:8px;color:#666;">Arbeitstage</td><td style="padding:8px;">${absence.days} Tage</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;color:#666;">Bearbeitet von</td><td style="padding:8px;">${actorName}</td></tr>
        </table>
      </div>
    `,
  })
}

async function sendWithdrawEmails(params: {
  absence: Absence
  employeeName: string
  employeeEmail: string
  actorName: string
}) {
  const { absence, employeeName, employeeEmail, actorName } = params
  const start = format(new Date(absence.start_date), "dd.MM.yyyy", { locale: de })
  const end = format(new Date(absence.end_date), "dd.MM.yyyy", { locale: de })

  const recipients = await getRecipientsForVacationStatusEmails([employeeEmail, ...ADMIN_EMAILS], "withdrawn")
  if (recipients.length === 0) {
    return
  }

  await sendEmail({
    to: recipients,
    subject: `Abwesenheitsantrag zurückgezogen: ${employeeName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2>Antrag zurückgezogen</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px;color:#666;">Mitarbeiter</td><td style="padding:8px;font-weight:bold;">${employeeName} (${employeeEmail})</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;color:#666;">Typ</td><td style="padding:8px;">${getAbsenceTypeLabel(absence.type)}</td></tr>
          <tr><td style="padding:8px;color:#666;">Zeitraum</td><td style="padding:8px;">${start} – ${end}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;color:#666;">Umfang</td><td style="padding:8px;">${getDayPartLabel(absence.day_part)}</td></tr>
          <tr><td style="padding:8px;color:#666;">Arbeitstage</td><td style="padding:8px;">${absence.days} Tage</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;color:#666;">Zurückgezogen von</td><td style="padding:8px;">${actorName}</td></tr>
        </table>
      </div>
    `,
  })
}

export async function requestAbsence(formData: FormData) {
  const session = (await getServerSession()) as any
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    throw new Error("Nicht angemeldet")
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const supabase = await createClient()

  const type = formData.get("type") as AbsenceType
  const startDate = formData.get("start_date") as string
  const endDate = formData.get("end_date") as string
  const dayPart = (formData.get("day_part") as "full" | "half_am" | "half_pm" | null) || "full"
  const reason = (formData.get("reason") as string) || null

  if (!type || !startDate || !endDate) throw new Error("Pflichtfelder fehlen")
  if (!HALF_DAY_TYPES.includes(type) && dayPart !== "full") {
    throw new Error("Halbe Tage sind nur für Urlaub, Sonderurlaub und Überstundenausgleich möglich")
  }
  if (dayPart !== "full" && startDate !== endDate) {
    throw new Error("Halbe Tage sind nur für einzelne Tage möglich")
  }

  if (type === "overtime_compensation") {
    // Nicht mehr abbauen, als auf dem Überstundenkonto ist.
    const [balance, scheduledHours] = await Promise.all([
      getOvertimeBalance(user.id),
      getScheduledHoursForRange(user.id, startDate, endDate),
    ])
    const requiredHours = dayPart === "full" ? scheduledHours : scheduledHours / 2

    if (requiredHours <= 0) {
      throw new Error("Im gewählten Zeitraum liegen keine planmäßigen Arbeitsstunden")
    }
    if (requiredHours > balance) {
      throw new Error(
        `Nicht genügend Überstunden: Der Ausgleich benötigt ${requiredHours.toFixed(2)} Std., verfügbar sind ${balance.toFixed(2)} Std.`,
      )
    }
  }

  const baseDays = await countVacationDaysExcludingHolidays(startDate, endDate, (user.bundesland as Bundesland) || "BY")
  const days = dayPart === "full" ? baseDays : 0.5

  if (days <= 0) {
    throw new Error("Für den gewählten Zeitraum entstehen keine buchbaren Arbeitstage")
  }

  if (type === "vacation") {
    const { data: overlaps, error: overlapError } = await supabase
      .from("absences")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "vacation")
      .in("status", ["pending", "approved"])
      .lte("start_date", endDate)
      .gte("end_date", startDate)

    if (overlapError) throw new Error("Fehler bei der Überschneidungsprüfung")
    if ((overlaps || []).length > 0) {
      throw new Error("Urlaubsantrag überschneidet sich mit einem bestehenden Urlaub")
    }

    const { data: blockedDays, error: blockedError } = await supabase
      .from("blocked_days")
      .select("date, reason, category")
      .gte("date", startDate)
      .lte("date", endDate)

    if (blockedError) throw new Error("Fehler beim Prüfen gesperrter Tage")
    
    // Filtere auf Tage, die für DIESE Teams gelten
    const applicableBlockedDays = (blockedDays || []).filter((bd) =>
      isBlockedDayApplicableToUser(bd as BlockedDay, user.category)
    )
    
    if (applicableBlockedDays.length > 0) {
      const firstBlocked = applicableBlockedDays[0]
      const blockedReason = firstBlocked?.reason ? ` (${firstBlocked.reason})` : ""
      throw new Error(`In diesem Zeitraum liegen gesperrte Tage${blockedReason}. Bitte Teamkalender prüfen.`)
    }

    // Team-Validierung: Prüfe, ob Urlaub in diesem Zeitraum für die Teams erlaubt ist
    if (user.category) {
      const vacationDays = eachDayOfInterval({ start: new Date(startDate), end: new Date(endDate) })
      const disallowedDays = vacationDays.filter((d) => !isVacationAllowedForCategory(user.category, d))
      
      if (disallowedDays.length > 0) {
        const categoryLabel = USER_CATEGORY_LABELS[user.category] || user.category
        const dayList = disallowedDays.map((d) => format(d, "dd.MM.yyyy")).join(", ")
        throw new Error(
          `${categoryLabel}: Urlaub an folgenden Tagen nicht erlaubt: ${dayList}`
        )
      }
    }
  }

  const { data: insertedAbsence, error } = await supabase
    .from("absences")
    .insert({
      user_id: user.id,
      type,
      start_date: startDate,
      end_date: endDate,
      days,
      day_part: dayPart,
      reason,
      status: "pending",
    })
    .select("id")
    .single()

  if (error) throw new Error("Fehler beim Erstellen des Antrags")

  const appBaseUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "")
  const approvalLink = `${appBaseUrl}/admin/vacation-requests?absenceId=${insertedAbsence.id}`

  // E-Mail an Admins
  const typeLabels: Record<string, string> = ABSENCE_TYPE_LABELS
  try {
    const recipients = await getRecipientsForVacationStatusEmails(ADMIN_EMAILS, "pending")
    if (recipients.length === 0) {
      revalidatePath("/urlaub")
      revalidatePath("/admin")
      return
    }

    await sendEmail({
      to: recipients,
      subject: `Neuer Abwesenheitsantrag: ${typeLabels[type]} – ${user.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2>Neuer Abwesenheitsantrag</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px;color:#666;">Mitarbeiter</td><td style="padding:8px;font-weight:bold;">${user.name} (${user.email})</td></tr>
            <tr style="background:#f9f9f9"><td style="padding:8px;color:#666;">Typ</td><td style="padding:8px;">${typeLabels[type]}</td></tr>
            <tr><td style="padding:8px;color:#666;">Zeitraum</td><td style="padding:8px;">${format(new Date(startDate), "dd.MM.yyyy", { locale: de })} – ${format(new Date(endDate), "dd.MM.yyyy", { locale: de })}</td></tr>
            <tr style="background:#f9f9f9"><td style="padding:8px;color:#666;">Arbeitstage</td><td style="padding:8px;">${days} Tage</td></tr>
            <tr><td style="padding:8px;color:#666;">Umfang</td><td style="padding:8px;">${dayPart === "full" ? "Ganztag" : dayPart === "half_am" ? "Halbtag (Vormittag)" : "Halbtag (Nachmittag)"}</td></tr>
            ${reason ? `<tr><td style="padding:8px;color:#666;">Begründung</td><td style="padding:8px;">${reason}</td></tr>` : ""}
          </table>
          <div style="margin-top:20px;">
            <a href="${approvalLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:600;">Direkt zum Antrag</a>
          </div>
          <p style="color:#666;font-size:12px;margin-top:12px;word-break:break-all;">${approvalLink}</p>
          <p style="color:#666;font-size:14px;margin-top:20px;">Bitte genehmige oder lehne den Antrag im System ab.</p>
        </div>
      `,
    })
  } catch (e) {
    console.error("[absences] E-Mail Fehler:", e)
  }

  revalidatePath("/urlaub")
  revalidatePath("/admin")
}

export async function updateMyAbsence(id: string, formData: FormData) {
  const session = (await getServerSession()) as any
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    throw new Error("Nicht angemeldet")
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const supabase = await createClient()

  const { data: currentAbsence, error: currentAbsenceError } = await supabase
    .from("absences")
    .select("*")
    .eq("id", id)
    .single()

  if (currentAbsenceError || !currentAbsence) throw new Error("Antrag nicht gefunden")
  if (currentAbsence.user_id !== user.id) throw new Error("Kein Zugriff")

  const today = format(new Date(), "yyyy-MM-dd")
  const canEdit =
    currentAbsence.status === "pending" ||
    (currentAbsence.type === "vacation" && currentAbsence.start_date > today)

  if (!canEdit) {
    throw new Error("Dieser Antrag kann nicht mehr bearbeitet werden")
  }

  const type = formData.get("type") as AbsenceType
  const startDate = formData.get("start_date") as string
  const endDate = formData.get("end_date") as string
  const dayPart = (formData.get("day_part") as "full" | "half_am" | "half_pm" | null) || "full"
  const reason = (formData.get("reason") as string) || null

  if (!type || !startDate || !endDate) throw new Error("Pflichtfelder fehlen")
  if (!HALF_DAY_TYPES.includes(type) && dayPart !== "full") {
    throw new Error("Halbe Tage sind nur für Urlaub, Sonderurlaub und Überstundenausgleich möglich")
  }
  if (dayPart !== "full" && startDate !== endDate) {
    throw new Error("Halbe Tage sind nur für einzelne Tage möglich")
  }

  const baseDays = await countVacationDaysExcludingHolidays(startDate, endDate, (user.bundesland as Bundesland) || "BY")
  const days = dayPart === "full" ? baseDays : 0.5

  if (days <= 0) {
    throw new Error("Für den gewählten Zeitraum entstehen keine buchbaren Arbeitstage")
  }

  if (type === "vacation") {
    const { data: overlaps, error: overlapError } = await supabase
      .from("absences")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "vacation")
      .in("status", ["pending", "approved"])
      .neq("id", id)
      .lte("start_date", endDate)
      .gte("end_date", startDate)

    if (overlapError) throw new Error("Fehler bei der Überschneidungsprüfung")
    if ((overlaps || []).length > 0) {
      throw new Error("Urlaubsantrag überschneidet sich mit einem bestehenden Urlaub")
    }

    const { data: blockedDays, error: blockedError } = await supabase
      .from("blocked_days")
      .select("date, reason, category")
      .gte("date", startDate)
      .lte("date", endDate)

    if (blockedError) throw new Error("Fehler beim Prüfen gesperrter Tage")

    const applicableBlockedDays = (blockedDays || []).filter((bd) =>
      isBlockedDayApplicableToUser(bd as BlockedDay, user.category)
    )

    if (applicableBlockedDays.length > 0) {
      const firstBlocked = applicableBlockedDays[0]
      const blockedReason = firstBlocked?.reason ? ` (${firstBlocked.reason})` : ""
      throw new Error(`In diesem Zeitraum liegen gesperrte Tage${blockedReason}. Bitte Teamkalender prüfen.`)
    }

    if (user.category) {
      const vacationDays = eachDayOfInterval({ start: new Date(startDate), end: new Date(endDate) })
      const disallowedDays = vacationDays.filter((d) => !isVacationAllowedForCategory(user.category, d))

      if (disallowedDays.length > 0) {
        const categoryLabel = USER_CATEGORY_LABELS[user.category] || user.category
        const dayList = disallowedDays.map((d) => format(d, "dd.MM.yyyy")).join(", ")
        throw new Error(`${categoryLabel}: Urlaub an folgenden Tagen nicht erlaubt: ${dayList}`)
      }
    }
  }

  const { error: updateError } = await supabase
    .from("absences")
    .update({
      type,
      start_date: startDate,
      end_date: endDate,
      day_part: dayPart,
      days,
      reason,
      status: "pending",
      reviewed_at: null,
      reviewed_by: null,
    })
    .eq("id", id)

  if (updateError) throw new Error("Fehler beim Speichern")

  revalidatePath("/urlaub")
  revalidatePath("/admin")
}

export async function getMyAbsences(): Promise<Absence[]> {
  const session = (await getServerSession()) as any
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) return []

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const supabase = await createClient()

  const { data } = await supabase
    .from("absences")
    .select("*")
    .eq("user_id", user.id)
    .order("start_date", { ascending: false })

  return (data || []) as Absence[]
}

export async function getAllAbsences(): Promise<Absence[]> {
  await requirePermission("vacation.manage_requests")

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("absences")
    .select("*, users:users!absences_user_id_fkey(name, email)")
    .order("created_at", { ascending: false })

  if (error) throw new Error(`Fehler beim Laden aller Abwesenheiten: ${error.message}`)

  return (data || []).map((a: any) => ({
    ...a,
    user: a.users,
  })) as Absence[]
}

/**
 * Für Kalender-/Teamansichten: Freitexte werden bewusst NICHT ausgeliefert. Kolleginnen und
 * Kollegen müssen wissen, DASS jemand abwesend ist – die Begründung (bei Krankheit ein
 * Gesundheitsdatum nach Art. 9 DSGVO, bei Sonderurlaub oft ebenso privat) geht sie nichts an.
 * Verwaltende Stellen lesen diese Felder über getAllAbsences.
 */
function mapAbsenceRows(data: unknown[] | null): Absence[] {
  return (data || []).map((a: any) => {
    const { reason, special_leave_reason, ...rest } = a
    return {
      ...rest,
      reason: null,
      user: a.users,
    }
  }) as Absence[]
}

/** Kalenderansicht: Umfang abhängig von Rechten (gesamtes Unternehmen vs. eigenes Team/Kategorie). */
export async function getAbsencesForCalendarView(): Promise<Absence[]> {
  const session = (await getServerSession()) as any
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    throw new Error("Nicht angemeldet")
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const access = await getCurrentUserAccess()
  const scope = getVacationCalendarAbsenceScope(access)

  if (!scope) {
    throw new Error("Kein Zugriff")
  }

  const supabase = await createClient()

  if (scope === "all") {
    const { data, error } = await supabase
      .from("absences")
      .select("*, users:users!absences_user_id_fkey(name, email)")
      .order("created_at", { ascending: false })

    if (error) throw new Error(`Fehler beim Laden der Abwesenheiten: ${error.message}`)
    return mapAbsenceRows(data)
  }

  let userIds = [user.id]
  if (user.category) {
    const { data: teammates } = await supabase.from("users").select("id").eq("category", user.category)
    userIds = [...new Set([user.id, ...(teammates || []).map((r: { id: string }) => r.id)])]
  }

  const { data, error } = await supabase
    .from("absences")
    .select("*, users:users!absences_user_id_fkey(name, email)")
    .in("user_id", userIds)
    .order("created_at", { ascending: false })

  if (error) throw new Error(`Fehler beim Laden der Team-Abwesenheiten: ${error.message}`)
  return mapAbsenceRows(data)
}

export async function updateAbsenceStatus(id: string, status: "approved" | "rejected") {
  const session = (await getServerSession()) as any
  await requirePermission("vacation.manage_requests")

  const actorName = session?.user?.name || session?.user?.email || "Admin"
  const supabase = await createClient()

  const { data: absenceData, error: absenceError } = await supabase
    .from("absences")
    .select("*, users:users!absences_user_id_fkey(name, email)")
    .eq("id", id)
    .single()

  if (absenceError || !absenceData) throw new Error("Antrag nicht gefunden")

  const actorDbUser = session?.user?.email ? await getUserByEmail(session.user.email) : null

  const updatePayload: Record<string, any> = {
    status,
    reviewed_at: new Date().toISOString(),
  }
  if (actorDbUser?.id) {
    updatePayload.reviewed_by = actorDbUser.id
  }

  const { error } = await supabase.from("absences").update(updatePayload).eq("id", id)
  if (error) throw new Error("Fehler beim Aktualisieren")

  // Überstundenausgleich wirkt sich erst mit der Genehmigung auf das Konto aus: dann entsteht
  // eine nachvollziehbare Abbuchung in Höhe der planmäßigen Stunden des Zeitraums. Bei Ablehnung
  // (auch nachträglich) wird eine bestehende Buchung wieder entfernt.
  if (absenceData.type === "overtime_compensation") {
    if (status === "approved") {
      const scheduledHours = await getScheduledHoursForRange(
        absenceData.user_id as string,
        absenceData.start_date as string,
        absenceData.end_date as string,
      )
      const hours = absenceData.day_part === "full" ? scheduledHours : scheduledHours / 2

      // upsert über den Unique-Index auf absence_id: eine erneute Genehmigung erzeugt keine
      // zweite Abbuchung (siehe scripts/021_overtime_adjustments.sql).
      const { error: adjustmentError } = await supabase.from("overtime_adjustments").upsert(
        {
          user_id: absenceData.user_id,
          effective_date: absenceData.start_date,
          hours: -Math.abs(hours),
          type: "compensation",
          reason: `Freizeitausgleich ${absenceData.start_date} bis ${absenceData.end_date}`,
          absence_id: id,
          created_by: actorDbUser?.id ?? null,
        },
        { onConflict: "absence_id" },
      )
      if (adjustmentError) {
        console.error("[absences] Ausgleichsbuchung fehlgeschlagen:", adjustmentError)
        throw new Error("Antrag genehmigt, aber die Überstunden-Buchung ist fehlgeschlagen")
      }
    } else {
      await supabase.from("overtime_adjustments").delete().eq("absence_id", id)
    }
  }

  try {
    await sendStatusChangeEmails({
      absence: absenceData as Absence,
      employeeName: (absenceData as any).users?.name || "Mitarbeiter",
      employeeEmail: (absenceData as any).users?.email || "",
      actorName,
      status,
    })
  } catch (mailError) {
    console.error("[absences] Status-Mail Fehler:", mailError)
  }

  await recordAudit({
    action: "absence.status.update",
    targetUserId: absenceData.user_id as string,
    entityType: "absences",
    entityId: id,
    before: { status: absenceData.status },
    after: { status, type: absenceData.type },
  })

  revalidatePath("/urlaub")
  revalidatePath("/admin")
}

/**
 * Legt eine Abwesenheit stellvertretend für einen Mitarbeitenden an – z.B. eine Krankmeldung,
 * die telefonisch reinkommt, oder gewährter Sonderurlaub. Anders als beim Selbstantrag ist die
 * Abwesenheit sofort genehmigt: Sie wird ja gerade von der genehmigenden Stelle eingetragen.
 */
export async function createAbsenceForUser(params: {
  userId: string
  type: AbsenceType
  startDate: string
  endDate: string
  dayPart?: "full" | "half_am" | "half_pm"
  reason?: string | null
  specialLeaveReason?: string | null
}) {
  await requirePermission("vacation.manage_requests")
  const access = await getCurrentUserAccess()
  const actor = access.dbUser
  if (!actor) throw new Error("Kein Zugriff")

  const { userId, type, startDate, endDate } = params
  const dayPart = params.dayPart || "full"

  if (!userId || !type || !startDate || !endDate) throw new Error("Pflichtfelder fehlen")
  if (endDate < startDate) throw new Error("Das Enddatum liegt vor dem Startdatum")
  if (!HALF_DAY_TYPES.includes(type) && dayPart !== "full") {
    throw new Error("Halbe Tage sind nur für Urlaub, Sonderurlaub und Überstundenausgleich möglich")
  }
  if (dayPart !== "full" && startDate !== endDate) {
    throw new Error("Halbe Tage sind nur für einzelne Tage möglich")
  }

  const supabase = await createClient()
  const { data: target } = await supabase.from("users").select("id, name, email, bundesland").eq("id", userId).single()
  if (!target) throw new Error("Mitarbeiter nicht gefunden")

  const baseDays = await countVacationDaysExcludingHolidays(
    startDate,
    endDate,
    (target.bundesland as Bundesland) || "BY",
  )
  const days = dayPart === "full" ? baseDays : 0.5
  if (days <= 0) {
    throw new Error("Für den gewählten Zeitraum entstehen keine buchbaren Arbeitstage")
  }

  const { data: inserted, error } = await supabase
    .from("absences")
    .insert({
      user_id: userId,
      type,
      start_date: startDate,
      end_date: endDate,
      day_part: dayPart,
      days,
      reason: params.reason || null,
      special_leave_reason: type === "special_leave" ? params.specialLeaveReason || null : null,
      status: "approved",
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
      created_by: actor.id,
    })
    .select("id")
    .single()

  if (error) throw new Error(`Fehler beim Anlegen: ${error.message}`)

  // Überstundenausgleich bucht wie bei der regulären Genehmigung vom Konto ab.
  if (type === "overtime_compensation" && inserted) {
    const scheduledHours = await getScheduledHoursForRange(userId, startDate, endDate)
    const hours = dayPart === "full" ? scheduledHours : scheduledHours / 2
    const { error: adjustmentError } = await supabase.from("overtime_adjustments").upsert(
      {
        user_id: userId,
        effective_date: startDate,
        hours: -Math.abs(hours),
        type: "compensation",
        reason: `Freizeitausgleich ${startDate} bis ${endDate} (durch Admin eingetragen)`,
        absence_id: inserted.id,
        created_by: actor.id,
      },
      { onConflict: "absence_id" },
    )
    if (adjustmentError) {
      console.error("[absences] Ausgleichsbuchung fehlgeschlagen:", adjustmentError)
      throw new Error("Abwesenheit angelegt, aber die Überstunden-Buchung ist fehlgeschlagen")
    }
  }

  await recordAudit({
    action: "absence.create_for_user",
    targetUserId: userId,
    entityType: "absences",
    entityId: inserted?.id ?? null,
    after: { type, start_date: startDate, end_date: endDate, day_part: dayPart, days },
  })

  revalidatePath("/admin")
  revalidatePath("/urlaub")
  revalidatePath("/admin/team-calendar")
  revalidatePath("/admin/vacation-requests")

  return { success: true }
}

export async function deleteAbsence(id: string) {
  const session = (await getServerSession()) as any
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) throw new Error("Nicht angemeldet")

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const access = await getCurrentUserAccess()
  const supabase = await createClient()

  // Nur eigene ausstehende Anträge oder Admin
  const { data: absence } = await supabase
    .from("absences")
    .select("*, users:users!absences_user_id_fkey(name, email)")
    .eq("id", id)
    .single()
  if (!absence) throw new Error("Nicht gefunden")
  const isOwnAbsence = absence.user_id === user.id
  const canManageRequests = access.canManageVacationRequests
  if (!isOwnAbsence && !canManageRequests) throw new Error("Kein Zugriff")

  if (!canManageRequests && isOwnAbsence) {
    const today = format(new Date(), "yyyy-MM-dd")
    const hasStarted = absence.start_date <= today
    const isVacation = absence.type === "vacation"

    if (isVacation) {
      if (hasStarted) {
        throw new Error("Eigene Urlaube können nur vor Start gelöscht werden")
      }
    } else if (absence.status !== "pending") {
      throw new Error("Nur ausstehende Anträge können gelöscht werden")
    }
  }

  await supabase.from("absences").delete().eq("id", id)

  try {
    await sendWithdrawEmails({
      absence: absence as Absence,
      employeeName: (absence as any).users?.name || session.user.name,
      employeeEmail: (absence as any).users?.email || session.user.email,
      actorName: session.user.name || session.user.email,
    })
  } catch (mailError) {
    console.error("[absences] Withdraw-Mail Fehler:", mailError)
  }

  revalidatePath("/urlaub")
  revalidatePath("/admin")
}

export async function getVacationBalance() {
  const session = (await getServerSession()) as any
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) {
    return { total: 30, used: 0, pending: 0, available: 30 }
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const supabase = await createClient()
  const year = new Date().getFullYear()
  const startOfYear = `${year}-01-01`
  const endOfYear = `${year}-12-31`

  const { data } = await supabase
    .from("absences")
    .select("days, status")
    .eq("user_id", user.id)
    .eq("type", "vacation")
    .gte("start_date", startOfYear)
    .lte("end_date", endOfYear)

  const total = user.vacation_days_per_year || 30
  const used = (data || []).filter((a) => a.status === "approved").reduce((s, a) => s + a.days, 0)
  const pending = (data || []).filter((a) => a.status === "pending").reduce((s, a) => s + a.days, 0)

  return { total, used, pending, available: total - used - pending }
}

export async function getBlockedDays(year: number, month: number): Promise<BlockedDay[]> {
  const session = (await getServerSession()) as any
  if (!session?.user?.email) return []

  // Get current user to check their category
  const dbUser = await getUserByEmail(session.user.email)
  const userCategory = dbUser?.category || null

  const supabase = await createClient()
  const { start, end } = getMonthDateRange(year, month)

  // Load both global and category-specific blocked days
  const { data, error } = await supabase
    .from("blocked_days")
    .select("id, date, reason, category")
    .gte("date", start)
    .lte("date", end)
    .order("date")

  if (error) throw new Error(`Fehler beim Laden gesperrter Tage: ${error.message}`)
  
  // Filter to show only applicable blocked days for this user
  const applicableBlockedDays = (data || []).filter((day) => isBlockedDayApplicableToUser(day, userCategory))
  return applicableBlockedDays as BlockedDay[]
}

export async function getAllBlockedDays(year: number, month: number): Promise<BlockedDay[]> {
  await requirePermission("vacation.manage_blocked_days")

  const supabase = await createClient()
  const { start, end } = getMonthDateRange(year, month)

  // Load ALL blocked days (for admin view)
  const { data, error } = await supabase
    .from("blocked_days")
    .select("id, date, reason, category")
    .gte("date", start)
    .lte("date", end)
    .order("date")

  if (error) throw new Error(`Fehler beim Laden gesperrter Tage: ${error.message}`)
  
  return (data || []) as BlockedDay[]
}

export async function blockDay(date: string, reason: string | null) {
  const session = (await getServerSession()) as any
  await requirePermission("vacation.manage_blocked_days")
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) throw new Error("Nicht angemeldet")

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const supabase = await createClient()

  const { data: existing, error: existingError } = await supabase
    .from("blocked_days")
    .select("id")
    .eq("date", date)
    .is("category", null)
    .maybeSingle()

  if (existingError) throw new Error(`Fehler beim Prüfen gesperrter Tage: ${existingError.message}`)

  if (existing?.id) {
    const { error } = await supabase
      .from("blocked_days")
      .update({ reason })
      .eq("id", existing.id)
    if (error) throw new Error(`Fehler beim Aktualisieren des Sperrtags: ${error.message}`)
  } else {
    const { error } = await supabase
      .from("blocked_days")
      .insert({ date, reason, category: null, created_by: user.id })
    if (error) throw new Error(`Fehler beim Anlegen des Sperrtags: ${error.message}`)
  }

  revalidatePath("/urlaub")
  revalidatePath("/urlaub/kalender")
  revalidatePath("/urlaub/admin")
  revalidatePath("/admin/team-calendar")
  revalidatePath("/admin/vacation-requests")
}

export async function blockDayForCategories(date: string, reason: string | null, categories: string[]) {
  const session = (await getServerSession()) as any
  await requirePermission("vacation.manage_blocked_days")
  if (!session?.user?.id || !session?.user?.email || !session?.user?.name) throw new Error("Nicht angemeldet")

  if (categories.length === 0) {
    throw new Error("Mindestens ein Team muss ausgewählt sein")
  }

  const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
  const supabase = await createClient()

  // Teams als komma-separate Liste speichern
  const categoryString = categories.join(",")

  // Prüfe, ob dieser Tag + dieses Team bereits gesperrt sind
  const { data: existing, error: existingError } = await supabase
    .from("blocked_days")
    .select("id")
    .eq("date", date)
    .eq("category", categoryString)
    .maybeSingle()

  if (existingError) throw new Error(`Fehler beim Prüfen gesperrter Tage: ${existingError.message}`)

  if (existing?.id) {
    const { error } = await supabase
      .from("blocked_days")
      .update({ reason })
      .eq("id", existing.id)
    if (error) throw new Error(`Fehler beim Aktualisieren des Sperrtags: ${error.message}`)
  } else {
    const { error } = await supabase
      .from("blocked_days")
      .insert({ date, reason, category: categoryString, created_by: user.id })
    if (error) throw new Error(`Fehler beim Anlegen des Sperrtags: ${error.message}`)
  }

  revalidatePath("/urlaub")
  revalidatePath("/urlaub/kalender")
  revalidatePath("/urlaub/admin")
  revalidatePath("/admin/team-calendar")
  revalidatePath("/admin/vacation-requests")
}

export async function unblockDay(date: string) {
  await requirePermission("vacation.manage_blocked_days")

  const supabase = await createClient()
  const { error } = await supabase
    .from("blocked_days")
    .delete()
    .eq("date", date)
    .is("category", null)

  if (error) throw new Error(`Fehler beim Entfernen des Sperrtags: ${error.message}`)

  revalidatePath("/urlaub")
  revalidatePath("/urlaub/kalender")
  revalidatePath("/urlaub/admin")
  revalidatePath("/admin/team-calendar")
  revalidatePath("/admin/vacation-requests")
}

export async function unblockDayForCategories(date: string, categories: string[]) {
  await requirePermission("vacation.manage_blocked_days")

  if (categories.length === 0) {
    throw new Error("Mindestens ein Team muss ausgewählt sein")
  }

  const categoryString = categories.join(",")
  const supabase = await createClient()
  const { error } = await supabase
    .from("blocked_days")
    .delete()
    .eq("date", date)
    .eq("category", categoryString)

  if (error) throw new Error(`Fehler beim Entfernen des Sperrtags: ${error.message}`)

  revalidatePath("/urlaub")
  revalidatePath("/urlaub/kalender")
  revalidatePath("/urlaub/admin")
  revalidatePath("/admin/team-calendar")
  revalidatePath("/admin/vacation-requests")
}

export async function getAbsencesForCalendar(year: number, month: number): Promise<Absence[]> {
  const session = (await getServerSession()) as any
  const canManageVacation = await hasVacationAdminAccess(session)
  if (!canManageVacation) {
    // Nur eigene
    if (!session?.user?.id || !session?.user?.email || !session?.user?.name) return []
    const user = await findOrCreateUser(session.user.id, session.user.email, session.user.name)
    const supabase = await createClient()
    const { start, end } = getMonthDateRange(year, month)
    const { data } = await supabase
      .from("absences")
      .select("*")
      .eq("user_id", user.id)
      .or(`start_date.lte.${end},end_date.gte.${start}`)
    return (data || []) as Absence[]
  }

  // Admin: alle
  const supabase = await createClient()
  const { start, end } = getMonthDateRange(year, month)
  const { data, error } = await supabase
    .from("absences")
    .select("*, users:users!absences_user_id_fkey(name, email)")
    .or(`start_date.lte.${end},end_date.gte.${start}`)
    .order("start_date")

  if (error) throw new Error(`Fehler beim Laden des Kalenders: ${error.message}`)

  return (data || []).map((a: any) => ({ ...a, user: a.users })) as Absence[]
}
