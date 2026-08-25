"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import {
  BETA_NOTICE_COOKIE,
  DASHBOARD_VIEW_COOKIE,
  VIEW_COOKIE_MAX_AGE,
  type DashboardView,
} from "@/lib/dashboard-view"

const COOKIE_OPTIONS = {
  // httpOnly: das Cookie wird ausschließlich serverseitig ausgewertet, JavaScript
  // im Browser braucht keinen Zugriff darauf.
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: VIEW_COOKIE_MAX_AGE,
}

/** Schaltet zwischen neuer (BETA) und klassischer Dashboard-Ansicht um. */
export async function setDashboardView(view: DashboardView) {
  const store = await cookies()
  store.set(DASHBOARD_VIEW_COOKIE, view === "classic" ? "classic" : "beta", COOKIE_OPTIONS)

  // Wer aktiv umschaltet, kennt die BETA – der Hinweis muss nicht erneut erscheinen.
  store.set(BETA_NOTICE_COOKIE, "1", COOKIE_OPTIONS)

  revalidatePath("/dashboard")
  return { success: true, view }
}

/** Merkt sich, dass der einmalige BETA-Hinweis gesehen wurde. */
export async function dismissBetaNotice() {
  const store = await cookies()
  store.set(BETA_NOTICE_COOKIE, "1", COOKIE_OPTIONS)
  return { success: true }
}
