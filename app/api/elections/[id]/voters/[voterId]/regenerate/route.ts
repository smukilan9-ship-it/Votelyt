import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeElection } from "@/lib/tenant";
import { regenerateVoterToken } from "@/lib/voterTokens";
import { requireSetupMutableElection, writeAuditLog } from "@/lib/electionIntegrity";

export const runtime = "nodejs";

// Regenerate the access code for a single voter. Returns the new code once.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; voterId: string }> }
) {
  const { id, voterId } = await params;
  const gate = await authorizeElection(id);
  if (!gate.ok) return NextResponse.json({ error: gate.status === 404 ? "Not found" : "Unauthorized" }, { status: gate.status });

  const election = await prisma.election.findUnique({
    where: { id },
    select: { id: true, authMode: true, status: true, activatedAt: true },
  });
  if (!election) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const mutable = await requireSetupMutableElection(gate.user, election, "voter_code.regenerate", { voterId });
  if (!mutable.ok) return mutable.response;
  if (election.authMode !== "ACCESS_CODE") {
    return NextResponse.json({ error: "This election uses two-field login, not access codes." }, { status: 400 });
  }

  const voter = await prisma.voter.findFirst({ where: { id: voterId, electionId: id }, select: { id: true, metadata: true } });
  if (!voter) return NextResponse.json({ error: "Voter not found" }, { status: 404 });

  try {
    const token = await prisma.$transaction(async (tx) => {
      const regenerated = await regenerateVoterToken(id, voterId, tx);
      await writeAuditLog(tx, {
        action: "VOTER_CODES_REGENERATED",
        userId: gate.user.id,
        electionId: id,
        metadata: { count: 1, scope: "single", voterId },
      });
      return regenerated;
    });
    return NextResponse.json({ voterId, metadata: voter.metadata, token });
  } catch {
    return NextResponse.json({ error: "Could not regenerate access code. Please try again." }, { status: 500 });
  }
}
