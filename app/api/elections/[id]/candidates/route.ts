import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeElection } from "@/lib/tenant";
import {
  blockedSetupMutationResponse,
  isSetupMutable,
  requireSetupMutableElection,
  writeAuditLog,
} from "@/lib/electionIntegrity";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await authorizeElection(id);
  if (!gate.ok) return NextResponse.json({ error: gate.status === 404 ? "Not found" : "Unauthorized" }, { status: gate.status });

  const election = await prisma.election.findUnique({
    where: { id },
    select: { id: true, status: true, activatedAt: true },
  });
  const mutable = await requireSetupMutableElection(gate.user, election, "candidate.create");
  if (!mutable.ok) return mutable.response;

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let positionId: string, name: string, description: string | null, photoUrl: string | null;
    const metadata: Record<string, string> = {};

    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      positionId = fd.get("positionId") as string;
      name = fd.get("name") as string;
      description = (fd.get("description") as string) || null;
      // Custom candidate fields arrive as `meta_<fieldName>` entries.
      for (const [k, v] of fd.entries()) {
        if (k.startsWith("meta_") && typeof v === "string" && v.trim()) {
          metadata[k.slice(5)] = v.trim();
        }
      }
      const file = fd.get("photo") as File | null;
      if (file && file.size > 0) {
        if (file.size > 2 * 1024 * 1024)
          return NextResponse.json({ error: "Photo must be under 2MB" }, { status: 400 });
        const buf = Buffer.from(await file.arrayBuffer());
        photoUrl = `data:${file.type};base64,${buf.toString("base64")}`;
      } else {
        photoUrl = null;
      }
    } else {
      const body = await req.json();
      positionId = body.positionId;
      name = body.name;
      description = body.description ?? null;
      photoUrl = null;
      if (body.metadata && typeof body.metadata === "object") {
        for (const [k, v] of Object.entries(body.metadata as Record<string, unknown>)) {
          if (typeof v === "string" && v.trim()) metadata[k] = v.trim();
        }
      }
    }

    if (!positionId || !name) {
      return NextResponse.json({ error: "positionId and name required" }, { status: 400 });
    }

    // Ensure the position belongs to this (owned) election.
    const position = await prisma.position.findFirst({
      where: { id: positionId, electionId: id },
      select: { id: true },
    });
    if (!position) {
      return NextResponse.json({ error: "Invalid position for this election" }, { status: 400 });
    }

    const candidate = await prisma.$transaction(async (tx) => {
      const created = await tx.candidate.create({
        data: {
          electionId: id,
          positionId,
          name,
          description,
          photoUrl,
          metadata,
        },
      });
      await writeAuditLog(tx, {
        action: "CANDIDATE_CREATED",
        userId: gate.user.id,
        electionId: id,
        metadata: { candidateId: created.id, positionId },
      });
      return created;
    });

    return NextResponse.json(candidate, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: electionId } = await params;
  const gate = await authorizeElection(electionId);
  if (!gate.ok) return NextResponse.json({ error: gate.status === 404 ? "Not found" : "Unauthorized" }, { status: gate.status });

  const { searchParams } = new URL(req.url);
  const candidateId = searchParams.get("candidateId");

  if (!candidateId) return NextResponse.json({ error: "candidateId required" }, { status: 400 });

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    select: { id: true, status: true, activatedAt: true },
  });
  if (!election) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await writeAuditLog(prisma, {
    action: "CANDIDATE_DELETE_ATTEMPTED",
    userId: gate.user.id,
    electionId,
    metadata: { candidateId, status: election.status, hasOpened: election.activatedAt !== null },
  });

  if (!isSetupMutable(election)) {
    return blockedSetupMutationResponse(gate.user, election, "candidate.delete", { candidateId });
  }

  await prisma.$transaction(async (tx) => {
    await tx.candidate.deleteMany({
      where: { id: candidateId, electionId },
    });
  });

  return NextResponse.json({ ok: true });
}
