export const dynamic = "force-dynamic"

import { LoginForm } from "@/components/login-form"
import { Suspense } from "react"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-2 lg:px-8">
        <section className="hidden lg:block">
          <div className="space-y-5">
            <p className="inline-flex items-center rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              SGS4x4 Workforce Hub
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">Moderne Zeiterfassung & Urlaubsplanung</h1>
            <p className="max-w-md text-base text-muted-foreground">
              Arbeitszeiten, Überstunden und Urlaub an einem Ort – schnell, klar und zuverlässig im täglichen Einsatz.
            </p>
          </div>
        </section>

        <section>
          <Suspense fallback={<div className="text-foreground">Laden...</div>}>
            <LoginForm />
          </Suspense>
        </section>
      </div>
    </div>
  )
}
