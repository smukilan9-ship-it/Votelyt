import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeElection } from "@/lib/tenant";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await authorizeElection(id);
  if (!gate.ok) return NextResponse.json({ error: gate.status === 404 ? "Not found" : "Unauthorized" }, { status: gate.status });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "Position title is required" }, { status: 400 });
  }

  const count = await prisma.position.count({ where: { electionId: id } });

  const position = await prisma.position.create({
    data: {
      electionId: id,
      title: body.title,
      description: body.description ?? null,
      maxWinners: body.maxWinners ?? 1,
      maxVotes: body.maxVotes ?? 1,
      restrictions: body.restrictions ?? {},
      sortOrder: count,
    },
  });

  return NextResponse.json(position, { status: 201 });
}
