import { getServerSession as getNextAuthSession, type NextAuthOptions } from "next-auth/next"

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "azure-ad",
      name: "Microsoft 365",
      type: "oauth",
      wellKnown: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0/.well-known/openid-configuration`,
      authorization: {
        params: {
          scope: "openid profile email User.Read GroupMember.Read.All",
        },
      },
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      idToken: true,
      checks: ["state"],
      profile(profile) {
        const roles = profile.roles || profile.groups || []

        return {
          id: profile.sub || profile.oid,
          name: profile.name,
          email: profile.email || profile.preferred_username,
          image: null,
          roles: roles,
        }
      },
    },
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (account && user) {
        token.accessToken = account.access_token
        token.userId = user.id
        token.roles = (user as any).roles || []

        if (account.access_token) {
          try {
            const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/memberOf", {
              headers: {
                Authorization: `Bearer ${account.access_token}`,
              },
            })

            if (graphResponse.ok) {
              const data = await graphResponse.json()
              const groups: string[] = data.value?.map((group: any) => group.displayName || group.id) || []
              token.roles = [...new Set([...(token.roles as string[]), ...groups])]

              const roleLower = (token.roles as string[]).map((r: string) => r.toLowerCase())
              const isGlobalAdmin   = roleLower.includes("global.admin")
              token.isAdmin        = isGlobalAdmin || roleLower.includes("zeiterfassung.admin")
              token.isReporter     = roleLower.includes("zeiterfassung.reporter")
              token.canUseVacation = isGlobalAdmin || roleLower.includes("urlaubsplanung.user") || roleLower.includes("urlaubsplanung.admin") || roleLower.includes("zeiterfassung.admin")
              token.isVacationAdmin= isGlobalAdmin || roleLower.includes("urlaubsplanung.admin") || roleLower.includes("zeiterfassung.admin")
            }
          } catch (error) {
            console.error("[v0] Error fetching M365 groups:", error)
            token.isAdmin         = false
            token.isReporter      = false
            token.canUseVacation  = false
            token.isVacationAdmin = false
          }
        } else {
          token.isAdmin         = false
          token.isReporter      = false
          token.canUseVacation  = false
          token.isVacationAdmin = false
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id             = token.userId as string
        session.user.roles          = (token.roles as string[]) || []
        session.user.isAdmin        = (token.isAdmin as boolean) || false
        session.user.isReporter     = (token.isReporter as boolean) || false
        session.user.canUseVacation = (token.canUseVacation as boolean) || false
        session.user.isVacationAdmin= (token.isVacationAdmin as boolean) || false
      }
      session.accessToken = token.accessToken as string
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === "development",
}

export async function getServerSession() {
  return getNextAuthSession(authOptions)
}
