"use client"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "next-auth/react"
import { LogOut, User, Shield, CalendarDays, Menu, Settings } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { usePathname } from "next/navigation"

interface DashboardHeaderProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
    roles?: string[]
  }
  isAdmin?: boolean
  isReporter?: boolean
  canUseVacation?: boolean
  isVacationAdmin?: boolean
}

export function DashboardHeader({ user, isAdmin, isReporter, canUseVacation, isVacationAdmin }: DashboardHeaderProps) {
  const canSeeAdmin = isAdmin || isReporter || isVacationAdmin
  const canManageVacation = isAdmin || isVacationAdmin
  const canSeeVacation = canUseVacation || canManageVacation
  const pathname = usePathname()
  const isVacationArea = pathname.startsWith("/urlaub")
  const isAdminArea = pathname.startsWith("/admin")
  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?"

  const navItemClass = (isActive: boolean) =>
    isActive
      ? "rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary"
      : "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"

  const vacationNavItemClass = (isActive: boolean) =>
    isActive
      ? "rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
      : "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"

  const adminNavItemClass = (isActive: boolean) =>
    isActive
      ? "rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
      : "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-3 rounded-lg">
              <Image
                src="/logo.png"
                alt="SGS 4X4"
                width={60}
                height={40}
                className="object-contain dark:invert-0 invert"
                priority
              />
              <span className="font-semibold text-lg text-foreground hidden sm:block">Zeiterfassung & Urlaubsplanung</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 rounded-xl border border-border/60 bg-card/80 p-1">
              <Link href="/dashboard" className={navItemClass(pathname === "/dashboard")}>
                Zeiterfassung
              </Link>
              {canSeeVacation && (
                <Link href="/urlaub" className={`${navItemClass(pathname.startsWith("/urlaub"))} flex items-center gap-1.5`}>
                  <CalendarDays className="h-4 w-4" />
                  Urlaubsplanung
                </Link>
              )}
              {canSeeAdmin && (
                <Link href="/admin" className={`${navItemClass(pathname.startsWith("/admin"))} flex items-center gap-1.5`}>
                  <Shield className="h-4 w-4" />
                  {isAdmin ? "Admin" : "Übersicht"}
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menü öffnen">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="end">
                <DropdownMenuLabel>Navigation</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <User className="mr-2 h-4 w-4" />
                    Zeiterfassung
                  </Link>
                </DropdownMenuItem>
                {canSeeVacation && (
                  <DropdownMenuItem asChild>
                    <Link href="/urlaub">
                      <CalendarDays className="mr-2 h-4 w-4" />
                      Urlaubsplanung
                    </Link>
                  </DropdownMenuItem>
                )}
                {canSeeAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Shield className="mr-2 h-4 w-4" />
                      {isAdmin ? "Admin" : "Übersicht"}
                    </Link>
                  </DropdownMenuItem>
                )}

                {(isVacationArea || isAdminArea) && <DropdownMenuSeparator />}

                {isVacationArea && canSeeVacation && (
                  <DropdownMenuItem asChild>
                    <Link href="/urlaub/team">Abwesenheitsübersicht</Link>
                  </DropdownMenuItem>
                )}

                {isAdminArea && canSeeAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">Userverwaltung</Link>
                  </DropdownMenuItem>
                )}
                {isAdminArea && isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/projects">Projekte</Link>
                  </DropdownMenuItem>
                )}
                {isAdminArea && canManageVacation && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/vacation-requests">Urlaubsanträge</Link>
                  </DropdownMenuItem>
                )}
                {isAdminArea && (canManageVacation || canUseVacation) && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/team-calendar">Teamkalender</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Einstellungen
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-1 ring-border/70">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.image || ""} alt={user.name || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    {isAdmin && <span className="text-xs text-primary font-medium mt-1">Administrator</span>}
                    {isReporter && !isAdmin && <span className="text-xs text-primary font-medium mt-1">Reporter</span>}
                    {isVacationAdmin && !isAdmin && <span className="text-xs text-primary font-medium mt-1">Urlaubs-Admin</span>}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <User className="mr-2 h-4 w-4" />
                    Zeiterfassung
                  </Link>
                </DropdownMenuItem>
                {canSeeVacation && (
                  <DropdownMenuItem asChild>
                    <Link href="/urlaub">
                      <CalendarDays className="mr-2 h-4 w-4" />
                      Urlaubsplanung
                    </Link>
                  </DropdownMenuItem>
                )}
                {canSeeAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Shield className="mr-2 h-4 w-4" />
                      {isAdmin ? "Admin-Bereich" : "Übersicht"}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Einstellungen
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isVacationArea && canSeeVacation && (
          <div className="hidden border-t border-border/60 py-2 md:flex md:items-center md:gap-1">
            <Link href="/urlaub" className={vacationNavItemClass(pathname === "/urlaub")}>
              Meine Abwesenheiten
            </Link>
            <Link href="/urlaub/team" className={vacationNavItemClass(pathname === "/urlaub/team")}>
              Abwesenheitsübersicht
            </Link>
          </div>
        )}

        {isAdminArea && canSeeAdmin && (
          <div className="hidden border-t border-border/60 py-2 md:flex md:items-center md:gap-1">
            <Link href="/admin" className={adminNavItemClass(pathname === "/admin")}>
              Userverwaltung
            </Link>
            {isAdmin && (
              <Link href="/admin/projects" className={adminNavItemClass(pathname.startsWith("/admin/projects"))}>
                Projekte
              </Link>
            )}
            {canManageVacation && (
              <Link href="/admin/vacation-requests" className={adminNavItemClass(pathname.startsWith("/admin/vacation-requests"))}>
                Urlaubsanträge
              </Link>
            )}
            {(canManageVacation || canUseVacation) && (
              <Link href="/admin/team-calendar" className={adminNavItemClass(pathname.startsWith("/admin/team-calendar"))}>
                Teamkalender
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
