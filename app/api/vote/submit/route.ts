import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, fingerprintToken } from "@/lib/tokens";

export const runtime = "nodejs";

interface VoteSelection {
  positionId: string;
  candidateIds: string[];
}

export async function POST(req: NextRequest) {
  let parsed: { electionId?: string; credentials?: Record<string, string>; selections?: VoteSelection[] };
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { electionId, credentials, selections } = parsed;

  if (!electionId || !credentials || !Array.isArray(selections)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) return NextResponse.json({ error: "Election not found" }, { status: 404 });
  if (election.status !== "ACTIVE") {
    return NextResponse.json({ error: "Election is not active" }, { status: 403 });
  }

  const isTwoFields = election.authMode === "TWO_FIELDS";
  const authFields = election.authFields as string[];

  // Re-authenticate voter
  let matchedVoter = null;

  if (isTwoFields) {
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
    // Access code — O(1) indexed lookup by token fingerprint, then bcrypt verify.
    const token = credentials.access_code ?? "";
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

  try {
    await prisma.$transaction(async (tx) => {
      // Atomically claim the right to vote: only one concurrent request can flip
      // hasVoted false→true. If the claim updates 0 rows, someone already voted.
      // Any later validation failure rolls the whole transaction back, releasing
      // the claim so the voter can legitimately retry.
      const claim = await tx.voter.updateMany({
        where: { id: matchedVoter!.id, hasVoted: false },
        data: { hasVoted: true, votedAt: new Date() },
      });
      if (claim.count !== 1) throw new Error("ALREADY_VOTED");

      const voter = await tx.voter.findUnique({ where: { id: matchedVoter!.id } });
      if (!voter) throw new Error("ALREADY_VOTED");

      const voterMeta = voter.metadata as Record<string, string>;
      const positions = await tx.position.findMany({
        where: { electionId },
        include: { candidates: true },
      });

      for (const sel of selections) {
        const position = positions.find((p) => p.id === sel.positionId);
        if (!position) throw new Error(`Position ${sel.positionId} not found`);

        const restrictions = position.restrictions as Record<string, string>;
        if (Object.keys(restrictions).length > 0) {
          const allowed = Object.entries(restrictions).every(
            ([key, val]) => voterMeta[key]?.toLowerCase() === val.toLowerCase()
          );
          if (!allowed) throw new Error(`Not eligible for position ${sel.positionId}`);
        }

        if (sel.candidateIds.length > position.maxVotes) {
          throw new Error(`Too many votes for position ${sel.positionId}`);
        }

        if (new Set(sel.candidateIds).size !== sel.candidateIds.length) {
          throw new Error(`Duplicate votes for position ${sel.positionId}`);
        }

        for (const candidateId of sel.candidateIds) {
          if (!position.candidates.find((c) => c.id === candidateId))
            throw new Error(`Invalid candidate ${candidateId}`);
        }
      }

      // If abstaining is disabled, every eligible position that has candidates
      // must receive a selection. Positions with no candidates are exempt.
      if (!election.allowAbstain) {
        const selectionsByPosition = new Map(
          selections.map((sel) => [sel.positionId, sel.candidateIds])
        );
        for (const position of positions) {
          if (position.candidates.length === 0) continue;

          const restrictions = position.restrictions as Record<string, string>;
          const eligible = Object.keys(restrictions).length === 0 ||
            Object.entries(restrictions).every(
              ([key, val]) => voterMeta[key]?.toLowerCase() === val.toLowerCase()
            );
          if (!eligible) continue;

          const chosen = selectionsByPosition.get(position.id) ?? [];
          if (chosen.length === 0) throw new Error("ABSTAIN_NOT_ALLOWED");
        }
      }

      for (const sel of selections) {
        for (const candidateId of sel.candidateIds) {
          await tx.vote.create({
            data: { electionId, positionId: sel.positionId, candidateId },
          });
        }
      }
      // hasVoted/votedAt were already set by the atomic claim above.
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "ALREADY_VOTED") {
      return NextResponse.json({ error: "You have already voted" }, { status: 409 });
    }
    if (msg === "ABSTAIN_NOT_ALLOWED") {
      return NextResponse.json({ error: "You must vote for every available position — abstaining is not allowed" }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
