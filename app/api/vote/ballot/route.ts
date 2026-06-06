import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, fingerprintToken } from "@/lib/tokens";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let parsed: { electionId?: string; credentials?: Record<string, string> };
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { electionId, credentials } = parsed;

  if (!electionId || !credentials) {
    return NextResponse.json({ error: "electionId and credentials required" }, { status: 400 });
  }

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: { voterFields: true },
  });

  if (!election) return NextResponse.json({ error: "Election not found" }, { status: 404 });
  if (election.status !== "ACTIVE") {
    return NextResponse.json({ error: "Election is not active" }, { status: 403 });
  }

  const isTwoFields = election.authMode === "TWO_FIELDS";
  const authFields = election.authFields as string[];

  let matchedVoter = null;

  if (isTwoFields) {
    // Find voter whose metadata matches both auth field values (case-insensitive)
    const voters = await prisma.voter.findMany({ where: { electionId } });
    for (const voter of voters) {
      const meta = voter.metadata as Record<string, string>;
      const matches = authFields.every(
        (field) =>
          meta[field] !== undefined &&
          credentials[field] !== undefined &&
          meta[field].toLowerCase().trim() === credentials[field].toLowerCase().trim()
      );
      if (matches) { matchedVoter = voter; break; }
    }
  } else {
    // Access code mode — O(1) indexed lookup by token fingerprint, then bcrypt verify.
    const token = credentials.access_code ?? "";
    if (!token) return NextResponse.json({ error: "Access code required" }, { status: 400 });
    const candidate = await prisma.voter.findFirst({
      where: { electionId, tokenLookup: fingerprintToken(token) },
    });
    if (candidate?.tokenHash && (await verifyToken(token.toUpperCase(), candidate.tokenHash))) {
      matchedVoter = candidate;
    }
  }

  if (!matchedVoter) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (matchedVoter.hasVoted) {
    return NextResponse.json({ error: "You have already voted" }, { status: 409 });
  }

  const voterMeta = matchedVoter.metadata as Record<string, string>;

  const positions = await prisma.position.findMany({
    where: { electionId },
    orderBy: { sortOrder: "asc" },
    include: { candidates: true },
  });

  const ballot = positions
    .filter((pos) => {
      const restrictions = pos.restrictions as Record<string, string>;
      if (!restrictions || Object.keys(restrictions).length === 0) return true;
      return Object.entries(restrictions).every(
        ([key, val]) => voterMeta[key]?.toLowerCase() === val.toLowerCase()
      );
    })
    .map((pos) => ({
      positionId: pos.id,
      title: pos.title,
      description: pos.description,
      maxVotes: pos.maxVotes,
      maxWinners: pos.maxWinners,
      candidates: pos.candidates.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        photoUrl: c.photoUrl,
      })),
    }));

  return NextResponse.json({
    voterId: matchedVoter.id,
    voterName: voterMeta.name ?? null,
    ballot,
  });
}
