"use client"

import type React from "react"
import { useState } from "react"

import { SessionProvider } from "next-auth/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/components/theme-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  // useState statt Modul-Konstante: verhindert, dass mehrere Nutzer (SSR) sich
  // einen QueryClient teilen; pro Component-Tree-Instanz genau einer.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Ersetzt die bisherigen 30s-Polling-Timer: Daten gelten 30s als frisch,
            // danach reicht ein Fokus-/Mount-Refetch statt Dauer-Polling.
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  )

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
