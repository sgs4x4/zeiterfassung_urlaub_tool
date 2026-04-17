// Bundesländer Konstanten
export const BUNDESLAENDER = {
  BW: "Baden-Württemberg",
  BY: "Bayern",
  BE: "Berlin",
  BB: "Brandenburg",
  HB: "Bremen",
  HH: "Hamburg",
  HE: "Hessen",
  MV: "Mecklenburg-Vorpommern",
  NI: "Niedersachsen",
  NW: "Nordrhein-Westfalen",
  RP: "Rheinland-Pfalz",
  SL: "Saarland",
  SN: "Sachsen",
  ST: "Sachsen-Anhalt",
  SH: "Schleswig-Holstein",
  TH: "Thüringen",
} as const

export type Bundesland = keyof typeof BUNDESLAENDER

export interface Holiday {
  id: string
  name: string
  date: string
  bundesland: string | null
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Hilfsfunktion: Prüft ob ein Datum ein Feiertag ist
export function isHoliday(date: Date, holidays: Holiday[]): boolean {
  const dateStr = toLocalDateString(date)
  return holidays.some((h) => h.date === dateStr)
}

// Hilfsfunktion: Berechnet Arbeitstage im Monat
export function getWorkingDaysInMonth(
  year: number,
  month: number,
  bundesland: Bundesland,
  holidays: Holiday[],
): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let workingDays = 0

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dayOfWeek = date.getDay()

    // Wochenende überspringen
    if (dayOfWeek === 0 || dayOfWeek === 6) continue
    // Feiertage überspringen
    if (isHoliday(date, holidays)) continue

    workingDays++
  }

  return workingDays
}

// Re-export für Kompatibilität (wird über Server Action genutzt)
export async function getHolidaysForBundesland(bundesland: Bundesland, year: number): Promise<Holiday[]> {
  // Diese Funktion ist nur ein Stub - die echte Implementierung ist in app/actions/holidays.ts
  // Sie wird hier nur exportiert um Build-Fehler zu vermeiden
  console.warn("getHolidaysForBundesland should be called from app/actions/holidays.ts")
  return []
}
