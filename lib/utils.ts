import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatHours(hours: number, withUnit = true) {
  const rounded = Math.round(hours * 100) / 100
  let formatted = rounded.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  formatted = formatted.replace(/,00$/, "")
  formatted = formatted.replace(/,0$/, "")
  return withUnit ? `${formatted} Std.` : formatted
}
