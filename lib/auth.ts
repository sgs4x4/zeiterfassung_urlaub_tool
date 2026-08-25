import { getServerSession as getNextAuthSession, type NextAuthOptions } from "next-auth/next"

// SECURITY NOTE (25.08.2026): next-auth@4.24.15 pinnt @auth/core als optionalen Peer
// fest auf 0.34.3 – diese Version enthält bekannte kritische CVEs (GHSA-7rqj-j65f-68wh,
// GHSA-xmf8-cvqr-rfgj, GHSA-x445-f3h2-j279). Ein Fix ohne next-auth-Major-Upgrade auf v5
// (Auth.js) ist nicht möglich. Akzeptiertes Risiko, weil hier weder ein DB-Adapter noch
// EmailProvider genutzt wird (nur Azure-AD-OAuth, siehe providers unten) – die
// betroffenen @auth/core-Codepfade werden also nicht ausgeführt. Bei Erweiterung um
// Adapter/EmailProvider: erst auf next-auth v5 migrieren.
export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "azure-ad",
      name: "Microsoft 365",
      type: "oauth",
      wellKnown: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0/.well-known/openid-configuration`,
      authorization: {
        params: {
          scope: "openid profile email User.Read",
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
    async jwt({ token, user, account }) {
      if (account && user) {
        token.accessToken = account.access_token
        token.userId = user.id
        token.roles = (user as any).roles || []
        // Rollen & Rechte ausschließlich aus der App-Datenbank (users.role + user_permissions), nicht aus Entra-Gruppen.
        token.isAdmin = false
        token.isReporter = false
        token.canUseVacation = false
        token.isVacationAdmin = false
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
