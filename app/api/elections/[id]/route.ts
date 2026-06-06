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

  const election = await prisma.election.findUnique({
    where: { id },
    include: {
      voterFields: { orderBy: { sortOrder: "asc" } },
      positions: {
        orderBy: { sortOrder: "asc" },
        include: { candidates: true },
      },
      _count: { select: { voters: true } },
    },
  });

  if (!election) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(election);
}

export async function PATCH(
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
  const { title, description, allowAbstain } = body;

  const election = await prisma.election.update({
    where: { id },
    data: {
      ...(typeof title === "string" ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(typeof allowAbstain === "boolean" ? { allowAbstain } : {}),
    },
  });

  return NextResponse.json(election);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await authorizeElection(id);
  if (!gate.ok) return NextResponse.json({ error: gate.status === 404 ? "Not found" : "Unauthorized" }, { status: gate.status });

  await prisma.election.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
