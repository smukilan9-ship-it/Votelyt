import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeElection } from "@/lib/tenant";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await authorizeElection(id);
  if (!gate.ok) return NextResponse.json({ error: gate.status === 404 ? "Not found" : "Unauthorized" }, { status: gate.status });

  const election = await prisma.election.findUnique({ where: { id } });
  if (!election) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (election.status !== "ENDED") {
    return NextResponse.json(
      { error: "Results are blocked until election ends" },
      { status: 403 }
    );
  }

  const positions = await prisma.position.findMany({
    where: { electionId: id },
    orderBy: { sortOrder: "asc" },
    include: {
      candidates: {
        include: {
          _count: { select: { votes: true } },
        },
      },
    },
  });

  const results = positions.map((pos) => {
    const sorted = [...pos.candidates].sort(
      (a, b) => b._count.votes - a._count.votes || a.name.localeCompare(b.name)
    );
    const cutoff = sorted[pos.maxWinners - 1]?._count.votes;

    return {
      positionId: pos.id,
      positionTitle: pos.title,
      maxWinners: pos.maxWinners,
      candidates: sorted.map((c) => {
        const firstWithVotes = sorted.findIndex((item) => item._count.votes === c._count.votes);
        return {
          id: c.id,
          name: c.name,
          photoUrl: c.photoUrl,
          votes: c._count.votes,
          rank: firstWithVotes + 1,
          isWinner: cutoff !== undefined && c._count.votes >= cutoff,
        };
      }),
    };
  });

  return NextResponse.json(results);
}
