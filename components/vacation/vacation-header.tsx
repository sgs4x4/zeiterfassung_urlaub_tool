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
import { LogOut, User, Clock, CalendarDays, Shield } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface VacationHeaderProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  isAdmin?: boolean
  isVacationAdmin?: boolean
}

export function VacationHeader({ user, isAdmin, isVacationAdmin }: VacationHeaderProps) {
  const pathname = usePathname()
  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?"

  const navLinks = [
    { href: "/urlaub", label: "Meine Abwesenheiten", exact: true }
  ]

  const navItemClass = (active: boolean) =>
    active
      ? "rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary"
      : "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-8">
          <Link href="/urlaub" className="flex items-center gap-3 rounded-lg">
            <Image
              src="/logo.png"
              alt="SGS 4X4"
              width={50}
              height={34}
              className="object-contain dark:invert-0 invert"
              priority
            />
            <div className="hidden sm:block">
              <span className="font-semibold text-base text-foreground">Urlaubsplanung</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 rounded-xl border border-border/60 bg-card/80 p-1">
            {navLinks.map((link) => {
              const active = link.exact ? pathname === link.href : pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(navItemClass(active))}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="hidden sm:flex">
            <Link href="/dashboard">
              <Clock className="h-4 w-4 mr-2" />
              Zeiterfassung
            </Link>
          </Button>

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
                  {(isAdmin || isVacationAdmin) && (
                    <span className="text-xs text-primary font-medium mt-1">Urlaubs-Admin</span>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/urlaub">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Meine Abwesenheiten
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard">
                  <Clock className="mr-2 h-4 w-4" />
                  Zur Zeiterfassung
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href="/admin">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin-Bereich
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                <LogOut className="mr-2 h-4 w-4" />
                Abmelden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
