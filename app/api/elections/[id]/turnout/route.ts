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

  const [total, voted, votedRows] = await Promise.all([
    prisma.voter.count({ where: { electionId: id } }),
    prisma.voter.count({ where: { electionId: id, hasVoted: true } }),
    prisma.voter.findMany({
      where: { electionId: id, hasVoted: true, votedAt: { not: null } },
      select: { votedAt: true },
      orderBy: { votedAt: "asc" },
    }),
  ]);

  // Cumulative turnout-over-time series as fraction of total (0..1), ~32 points.
  // `votedRows` is already ordered by votedAt asc, so we sweep it with a single
  // moving pointer instead of re-scanning every stamp per step (O(N+STEPS), not O(N*STEPS)).
  const stamps = votedRows.map((r) => r.votedAt!.getTime());
  let series: { t: number; v: number }[] = [];
  if (stamps.length > 0 && total > 0) {
    const start = stamps[0];
    const end = stamps[stamps.length - 1];
    const span = Math.max(end - start, 1);
    const STEPS = 32;
    series = new Array(STEPS + 1);
    let cursor = 0;
    for (let i = 0; i <= STEPS; i++) {
      const t = start + (span * i) / STEPS;
      while (cursor < stamps.length && stamps[cursor] <= t) cursor++;
      series[i] = { t: i / STEPS, v: cursor / total };
    }
  }

  return NextResponse.json({
    total,
    voted,
    pending: total - voted,
    percentage: total > 0 ? Math.round((voted / total) * 100) : 0,
    series,
  });
}
