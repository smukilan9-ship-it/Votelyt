import { randomUUID } from "node:crypto";
import { Prisma, type ElectionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import type { SessionUser } from "./auth";

type DbClient = typeof prisma | Prisma.TransactionClient;

export interface ElectionIntegrityState {
  id: string;
  status: ElectionStatus;
  activatedAt: Date | null;
}

export const SETUP_LOCKED_MESSAGE =
  "Election draft configuration is locked after polls open. Only monitoring and ending the election are allowed.";

export function isSetupMutable(election: ElectionIntegrityState): boolean {
  return election.status === "DRAFT" && election.activatedAt === null;
}

export async function writeAuditLog(
  db: DbClient,
  input: {
    action: string;
    userId: string;
    electionId: string;
    metadata?: Prisma.InputJsonValue;
  }
) {
  const metadata = input.metadata === undefined ? null : JSON.stringify(input.metadata);

  await db.$executeRaw`
    INSERT INTO "audit_logs" ("id", "action", "userId", "electionId", "metadata")
    VALUES (${randomUUID()}, ${input.action}, ${input.userId}, ${input.electionId}, ${metadata}::jsonb)
  `;
}

export async function blockedSetupMutationResponse(
  user: SessionUser,
  election: ElectionIntegrityState,
  attemptedAction: string,
  metadata: Prisma.InputJsonObject = {}
) {
  await writeAuditLog(prisma, {
    action: "BLOCKED_ACTIVE_MUTATION",
    userId: user.id,
    electionId: election.id,
    metadata: {
      attemptedAction,
      status: election.status,
      hasOpened: election.activatedAt !== null,
      ...metadata,
    },
  });

  return NextResponse.json({ error: SETUP_LOCKED_MESSAGE }, { status: 403 });
}

export async function requireSetupMutableElection(
  user: SessionUser,
  election: ElectionIntegrityState | null,
  attemptedAction: string,
  metadata?: Prisma.InputJsonObject
) {
  if (!election) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  if (!isSetupMutable(election)) {
    return {
      ok: false as const,
      response: await blockedSetupMutationResponse(user, election, attemptedAction, metadata),
    };
  }

  return { ok: true as const, election };
}
