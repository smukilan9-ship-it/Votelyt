import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "./authOptions";

export interface SessionUser {
  id: string;
  role: string;
}

/**
 * Returns the authenticated user (id + role) or null.
 * Wrapped in React `cache()` so the layout + page(s) in a single request share
 * one session decode instead of repeating it per call.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return { id: session.user.id, role: session.user.role };
});

/**
 * Auth guard for Route Handlers. Returns `{ ok: true, user }` when signed in,
 * otherwise `{ ok: false }` — callers respond 401.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const };
  return { ok: true as const, user };
}
