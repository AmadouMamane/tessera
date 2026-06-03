/**
 * Auth.js (NextAuth v5) configuration for the dashboard (ADR 0009).
 *
 * Front-only authentication: the agent keeps its service bearer; end-user
 * identity is a front concern. JWT session strategy (stateless, no store) —
 * required by the Credentials provider. The role is carried as a JWT claim and
 * read server-side via `auth()` to gate operator surfaces.
 *
 * `trustHost` is required off-Vercel (Cloud Run / custom domain) so Auth.js
 * accepts the forwarded host instead of rejecting it.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { type Role, verifyCredentials } from "@/lib/auth/accounts";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Operator",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize(raw) {
        const username = typeof raw?.username === "string" ? raw.username : "";
        const password = typeof raw?.password === "string" ? raw.password : "";
        const result = verifyCredentials(username, password);
        return result ? { id: username, name: username, role: result.role } : null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user && "role" in user) token.role = (user as { role: Role }).role;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.role) session.user.role = token.role as Role;
      return session;
    },
  },
});
