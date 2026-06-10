import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeElection } from "@/lib/tenant";
import { writeAuditLog } from "@/lib/electionIntegrity";

type RequestedStatus = "DRAFT" | "ACTIVE" | "ENDED";

function isAllowedTransition(from: RequestedStatus, to: RequestedStatus) {
  return (from === "DRAFT" && to === "ACTIVE") || (from === "ACTIVE" && to === "ENDED");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await authorizeElection(id);
  if (!gate.ok) return NextResponse.json({ error: gate.status === 404 ? "Not found" : "Unauthorized" }, { status: gate.status });

  let status: unknown;
  try {
    ({ status } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof status !== "string" || !["DRAFT", "ACTIVE", "ENDED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const requestedStatus = status as RequestedStatus;

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.election.findUnique({
      where: { id },
      select: { id: true, status: true, activatedAt: true },
    });
    if (!current) return { type: "not-found" as const };

    if (!isAllowedTransition(current.status, requestedStatus)) {
      await writeAuditLog(tx, {
        action: "INVALID_STATUS_TRANSITION",
        userId: gate.user.id,
        electionId: id,
        metadata: { from: current.status, to: requestedStatus },
      });
      return { type: "invalid-transition" as const, from: current.status, to: requestedStatus };
    }

    const now = new Date();
    const update = await tx.election.updateMany({
      where: { id, status: current.status },
      data: {
        status: requestedStatus,
        ...(requestedStatus === "ACTIVE" ? { activatedAt: current.activatedAt ?? now } : {}),
      },
    });
    if (update.count !== 1) {
      await writeAuditLog(tx, {
        action: "INVALID_STATUS_TRANSITION",
        userId: gate.user.id,
        electionId: id,
        metadata: { from: current.status, to: requestedStatus, reason: "status_changed" },
      });
      return { type: "status-changed" as const };
    }

    const election = await tx.election.findUniqueOrThrow({ where: { id } });
    await writeAuditLog(tx, {
      action: requestedStatus === "ACTIVE" ? "ELECTION_ACTIVATED" : "ELECTION_ENDED",
      userId: gate.user.id,
      electionId: id,
      metadata: { from: current.status, to: requestedStatus },
    });
    return { type: "ok" as const, election };
  });

  if (result.type === "not-found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (result.type === "invalid-transition") {
    return NextResponse.json(
      {
        error: `Invalid status transition: ${result.from} -> ${result.to}. Allowed transitions are DRAFT -> ACTIVE and ACTIVE -> ENDED.`,
      },
      { status: 400 }
    );
  }
  if (result.type === "status-changed") {
    return NextResponse.json(
      { error: "Election status changed while processing the request. Please reload and try again." },
      { status: 409 }
    );
  }

  return NextResponse.json(result.election);
}
