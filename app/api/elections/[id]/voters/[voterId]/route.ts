import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeElection } from "@/lib/tenant";

export const runtime = "nodejs";

// Remove a single voter from the roll. Only permitted while the election is in
// DRAFT (setup); once it has opened, the roll is frozen so turnout and access
// codes stay consistent for the duration of the vote.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; voterId: string }> }
) {
  const { id, voterId } = await params;
  const gate = await authorizeElection(id);
  if (!gate.ok) return NextResponse.json({ error: gate.status === 404 ? "Not found" : "Unauthorized" }, { status: gate.status });

  const election = await prisma.election.findUnique({ where: { id }, select: { status: true } });
  if (!election) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (election.status !== "DRAFT") {
    return NextResponse.json({ error: "Voters cannot be removed after the election has opened." }, { status: 409 });
  }

  const voter = await prisma.voter.findFirst({ where: { id: voterId, electionId: id }, select: { id: true } });
  if (!voter) return NextResponse.json({ error: "Voter not found" }, { status: 404 });

  await prisma.voter.delete({ where: { id: voterId } });
  return NextResponse.json({ ok: true });
}
