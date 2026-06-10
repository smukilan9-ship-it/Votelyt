import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeElection } from "@/lib/tenant";
import { regenerateVoterToken } from "@/lib/voterTokens";
import { requireSetupMutableElection, writeAuditLog } from "@/lib/electionIntegrity";

export const runtime = "nodejs";
export const maxDuration = 60; // bcrypt-per-voter can run long on big rolls

// Generating bcrypt hashes is CPU-bound (~tens of ms each); cap a single bulk
// call so it can't blow past the serverless time budget. Larger rolls should be
// regenerated in batches from the client.
const MAX_BULK = 500;

// Bulk-regenerate access codes for all voters in the election, or a provided
// subset. Returns the new codes once (download-and-distribute).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await authorizeElection(id);
  if (!gate.ok) return NextResponse.json({ error: gate.status === 404 ? "Not found" : "Unauthorized" }, { status: gate.status });

  const election = await prisma.election.findUnique({
    where: { id },
    select: { id: true, authMode: true, status: true, activatedAt: true },
  });
  if (!election) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const mutable = await requireSetupMutableElection(gate.user, election, "voter_codes.regenerate");
  if (!mutable.ok) return mutable.response;
  if (election.authMode !== "ACCESS_CODE") {
    return NextResponse.json({ error: "This election uses two-field login, not access codes." }, { status: 400 });
  }

  let voterIds: string[] | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body?.voterIds)) voterIds = body.voterIds.filter((v: unknown) => typeof v === "string");
  } catch {
    /* empty body = regenerate all */
  }

  const voters = await prisma.voter.findMany({
    where: { electionId: id, ...(voterIds ? { id: { in: voterIds } } : {}) },
    select: { id: true, metadata: true },
    orderBy: { createdAt: "asc" },
  });

  if (voters.length === 0) return NextResponse.json({ error: "No matching voters" }, { status: 404 });
  if (voters.length > MAX_BULK) {
    return NextResponse.json(
      { error: `Too many voters for one regeneration (${voters.length}). Regenerate in batches of ${MAX_BULK} or fewer.` },
      { status: 413 }
    );
  }

  const results: { voterId: string; metadata: unknown; token: string }[] = [];
  try {
    for (const voter of voters) {
      const token = await regenerateVoterToken(id, voter.id);
      results.push({ voterId: voter.id, metadata: voter.metadata, token });
    }
  } catch {
    if (results.length > 0) {
      await writeAuditLog(prisma, {
        action: "VOTER_CODES_REGENERATED",
        userId: gate.user.id,
        electionId: id,
        metadata: { count: results.length, scope: "bulk", partial: true },
      }).catch(() => {});
    }
    return NextResponse.json({ error: "Regeneration failed partway. Please retry.", regenerated: results.length }, { status: 500 });
  }

  await writeAuditLog(prisma, {
    action: "VOTER_CODES_REGENERATED",
    userId: gate.user.id,
    electionId: id,
    metadata: {
      count: results.length,
      scope: "bulk",
      ...(voterIds ? { requestedCount: voterIds.length } : {}),
    },
  });

  return NextResponse.json({ regenerated: results.length, tokens: results });
}
