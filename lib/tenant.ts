import { prisma } from "./prisma";
import { requireUser, getCurrentUser, type SessionUser } from "./auth";

export { requireUser, getCurrentUser };
export type { SessionUser };

/**
 * Tenant scope to spread into a Prisma `where`. Regular users are constrained
 * to their own elections; superadmins see everything.
 *
 *   prisma.election.findMany({ where: { ...ownerScope(user) } })
 */
export function ownerScope(user: SessionUser): { ownerId?: string } {
  return user.role === "SUPERADMIN" ? {} : { ownerId: user.id };
}

/**
 * True if `user` may access the election. Uses a single owner-scoped query so a
 * non-owner is indistinguishable from a non-existent election (callers respond
 * 404, never 403 — avoids leaking which ids exist).
 */
export async function canAccessElection(user: SessionUser, electionId: string): Promise<boolean> {
  const found = await prisma.election.findFirst({
    where: { id: electionId, ...ownerScope(user) },
    select: { id: true },
  });
  return found !== null;
}

type AuthOk = { ok: true; user: SessionUser };
type AuthErr = { ok: false; status: 401 | 404 };

/**
 * One-call guard for `/api/elections/[id]/*` route handlers: verifies the
 * session AND ownership of `electionId`.
 *
 *   const gate = await authorizeElection(id);
 *   if (!gate.ok) return NextResponse.json({ error }, { status: gate.status });
 *   // gate.user is safe to use
 */
export async function authorizeElection(electionId: string): Promise<AuthOk | AuthErr> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, status: 401 };
  if (!(await canAccessElection(auth.user, electionId))) return { ok: false, status: 404 };
  return { ok: true, user: auth.user };
}
