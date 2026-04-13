"use server"

import { createClient } from "@/lib/supabase/server"
import type { Bundesland, Holiday } from "@/lib/holidays"

function toDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function easterSunday(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function buildGeneratedHolidays(year: number, bundesland?: Bundesland): Holiday[] {
  const easter = easterSunday(year)
  const nationWide: Array<{ name: string; date: Date }> = [
    { name: "Neujahr", date: new Date(year, 0, 1) },
    { name: "Karfreitag", date: addDays(easter, -2) },
    { name: "Ostermontag", date: addDays(easter, 1) },
    { name: "Tag der Arbeit", date: new Date(year, 4, 1) },
    { name: "Christi Himmelfahrt", date: addDays(easter, 39) },
    { name: "Pfingstmontag", date: addDays(easter, 50) },
    { name: "Tag der Deutschen Einheit", date: new Date(year, 9, 3) },
    { name: "1. Weihnachtstag", date: new Date(year, 11, 25) },
    { name: "2. Weihnachtstag", date: new Date(year, 11, 26) },
  ]

  const bussUndBettag = (() => {
    const date = new Date(year, 10, 22)
    while (date.getDay() !== 3) {
      date.setDate(date.getDate() - 1)
    }
    return date
  })()

  const stateRules: Array<{ name: string; date: Date; states: Bundesland[] }> = [
    { name: "Heilige Drei Könige", date: new Date(year, 0, 6), states: ["BW", "BY", "ST"] },
    { name: "Internationaler Frauentag", date: new Date(year, 2, 8), states: ["BE", "MV"] },
    { name: "Ostersonntag", date: easter, states: ["BB"] },
    { name: "Pfingstsonntag", date: addDays(easter, 49), states: ["BB"] },
    { name: "Fronleichnam", date: addDays(easter, 60), states: ["BW", "BY", "HE", "NW", "RP", "SL"] },
    { name: "Mariä Himmelfahrt", date: new Date(year, 7, 15), states: ["BY", "SL"] },
    { name: "Weltkindertag", date: new Date(year, 8, 20), states: ["TH"] },
    { name: "Reformationstag", date: new Date(year, 9, 31), states: ["BB", "HB", "HH", "MV", "NI", "SH", "SN", "ST", "TH"] },
    { name: "Allerheiligen", date: new Date(year, 10, 1), states: ["BW", "BY", "NW", "RP", "SL"] },
    { name: "Buß- und Bettag", date: bussUndBettag, states: ["SN"] },
  ]

  const holidays: Holiday[] = nationWide.map((holiday, index) => ({
    id: `generated-${year}-de-${index}`,
    name: holiday.name,
    date: toDateString(holiday.date),
    bundesland: null,
  }))

  if (bundesland) {
    stateRules
      .filter((rule) => rule.states.includes(bundesland))
      .forEach((holiday, index) => {
        holidays.push({
          id: `generated-${year}-${bundesland}-${index}`,
          name: holiday.name,
          date: toDateString(holiday.date),
          bundesland,
        })
      })
  }

  return holidays
}

export async function getHolidaysForYear(year: number, bundesland?: Bundesland): Promise<Holiday[]> {
  const supabase = await createClient()

  let query = supabase
    .from("holidays")
    .select("*")
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`)
    .order("date")

  if (bundesland) {
    query = query.or(`bundesland.is.null,bundesland.eq.${bundesland}`)
  }

  const { data, error } = await query

  const generated = buildGeneratedHolidays(year, bundesland)

  if (error) {
    console.error("Error fetching holidays:", error)
    return generated
  }

  const merged = [...(data || []), ...generated]
  const unique = new Map<string, Holiday>()

  for (const holiday of merged) {
    const key = `${holiday.date}-${holiday.name}-${holiday.bundesland ?? "ALL"}`
    if (!unique.has(key)) {
      unique.set(key, holiday)
    }
  }

  return Array.from(unique.values()).sort((a, b) => a.date.localeCompare(b.date))
}
