import "server-only"

import { cookies } from "next/headers"

export type DashboardView = "beta" | "classic"

export const DASHBOARD_VIEW_COOKIE = "dashboard_view"
export const BETA_NOTICE_COOKIE = "dashboard_beta_notice_seen"

/** Ein Jahr – der Schalter soll nicht ungefragt zurückspringen. */
export const VIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * Welche Dashboard-Variante der Nutzer sehen soll. Bewusst als Cookie und nicht im
 * localStorage: die Dashboard-Seite ist eine Server Component und kann so direkt die
 * richtige Variante rendern, statt erst die BETA zu zeigen und clientseitig umzuschalten.
 * Standard ist die neue Ansicht – die klassische muss aktiv gewählt werden.
 */
export async function getDashboardView(): Promise<DashboardView> {
  const store = await cookies()
  return store.get(DASHBOARD_VIEW_COOKIE)?.value === "classic" ? "classic" : "beta"
}

/** Ob dem Nutzer der einmalige BETA-Hinweis in diesem Browser schon gezeigt wurde. */
export async function hasSeenBetaNotice(): Promise<boolean> {
  const store = await cookies()
  return store.get(BETA_NOTICE_COOKIE)?.value === "1"
}
