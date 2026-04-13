"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { signIn, useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const error = searchParams?.get("error") || null
  const callbackUrlParam = searchParams?.get("callbackUrl") || "/dashboard"
  const callbackUrl =
    callbackUrlParam.startsWith("/") && !callbackUrlParam.startsWith("//") && !callbackUrlParam.startsWith("/login")
      ? callbackUrlParam
      : "/dashboard"

  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push(callbackUrl)
    }
  }, [session, status, router, callbackUrl])

  if (status === "loading") {
    return (
      <Card className="mx-auto w-full max-w-md border-border/70 bg-card/90 shadow-lg">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  const handleM365Login = async () => {
    setIsLoading(true)
    try {
      await signIn("azure-ad", { callbackUrl })
    } catch (error) {
      console.error("Login error:", error)
      setIsLoading(false)
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md border-border/70 bg-card/90 shadow-lg">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-center mb-6">
          <Image
            src="/logo.png"
            alt="SGS 4X4"
            width={120}
            height={80}
            className="object-contain dark:invert-0 invert"
            priority
          />
        </div>
        <CardTitle className="text-center text-2xl font-semibold tracking-tight text-foreground">Willkommen zurück</CardTitle>
        <CardDescription className="text-center text-muted-foreground">
          Melde dich mit deinem Microsoft 365 Account an
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            Anmeldefehler:{" "}
            {error === "OAuthCallback"
              ? "OAuth Callback fehlgeschlagen. Bitte überprüfe die Azure AD Konfiguration."
              : error === "Callback"
                ? "Session konnte nicht erstellt werden. Bitte erneut versuchen."
                : error}
          </div>
        )}
        <Button
          onClick={handleM365Login}
          disabled={isLoading}
          className="h-11 w-full bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Anmeldung läuft...
            </>
          ) : (
            <>
              <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.5 2v9.5H2V2h9.5zm0 20v-9.5H2V22h9.5zm10.5 0h-9.5v-9.5H22V22zM22 2v9.5h-9.5V2H22z" />
              </svg>
              Mit Microsoft 365 anmelden
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
