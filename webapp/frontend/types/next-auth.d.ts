/**
 * Augment Auth.js types with the operator `role` claim (ADR 0009).
 */
import type { DefaultSession } from "next-auth";

import type { Role } from "@/lib/auth/accounts";

declare module "next-auth" {
  interface Session {
    user: { role?: Role } & DefaultSession["user"];
  }
  interface User {
    role?: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
  }
}
