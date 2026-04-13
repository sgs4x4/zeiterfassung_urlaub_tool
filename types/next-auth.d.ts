import "next-auth"
import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    idToken?: string
    user: {
      id: string
      roles?: string[]
      isAdmin: boolean
      isReporter: boolean
      canUseVacation: boolean
      isVacationAdmin: boolean
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    roles?: string[]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    idToken?: string
    userId?: string
    profile?: any
    roles?: string[]
    isAdmin?: boolean
    isReporter?: boolean
    canUseVacation?: boolean
    isVacationAdmin?: boolean
  }
}
