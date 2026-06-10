import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, ownerScope } from "@/lib/tenant";
import { generateElectionId } from "@/lib/tokens";
import { buildSchoolPositions, SCHOOL_VOTER_FIELDS, SCHOOL_AUTH_FIELDS } from "@/lib/templates";
import { writeAuditLog } from "@/lib/electionIntegrity";

/**
 * Allocate a fresh 6-character election id and run the create. Retries on the
 * astronomically rare primary-key collision (Prisma P2002) so a duplicate short
 * id can never surface to the caller.
 */
async function createElectionWithShortId<T>(build: (id: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await build(generateElectionId());
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("Could not allocate a unique election id");
}

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const elections = await prisma.election.findMany({
    where: { ...ownerScope(auth.user) },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { voters: true, candidates: true, positions: true } },
    },
  });

  return NextResponse.json(elections);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = auth.user.id;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { title, description, template, voterFields, positions, authMode, authFields, allowAbstain, candidateFields } = body;
  const resolvedCandidateFields = Array.isArray(candidateFields) ? candidateFields : [];

  if (!title || typeof title !== "string") return NextResponse.json({ error: "Title required" }, { status: 400 });

  const resolvedAuthMode = authMode === "TWO_FIELDS" ? "TWO_FIELDS" : "ACCESS_CODE";
  const resolvedAllowAbstain = allowAbstain !== false;

  if (template === "SCHOOL") {
    const resolvedAuthFields = resolvedAuthMode === "TWO_FIELDS" ? SCHOOL_AUTH_FIELDS : [];
    const election = await createElectionWithShortId((id) =>
      prisma.$transaction(async (tx) => {
        const created = await tx.election.create({
          data: {
            id,
            title,
            description,
            template: "SCHOOL",
            ownerId,
            authMode: resolvedAuthMode,
            authFields: resolvedAuthFields,
            allowAbstain: resolvedAllowAbstain,
            voterFields: { create: SCHOOL_VOTER_FIELDS },
            positions: { create: buildSchoolPositions() },
          },
          include: { voterFields: true, positions: true },
        });
        await writeAuditLog(tx, {
          action: "ELECTION_CREATED",
          userId: ownerId,
          electionId: created.id,
          metadata: { template: "SCHOOL", authMode: resolvedAuthMode },
        });
        return created;
      })
    );
    return NextResponse.json(election, { status: 201 });
  }

  // GENERIC
  const resolvedAuthFields = resolvedAuthMode === "TWO_FIELDS" ? (authFields ?? []) : [];
  if (resolvedAuthMode === "TWO_FIELDS" && resolvedAuthFields.length !== 2) {
    return NextResponse.json({ error: "Exactly two auth fields required for two_fields mode" }, { status: 400 });
  }

  const election = await createElectionWithShortId((id) =>
    prisma.$transaction(async (tx) => {
      const created = await tx.election.create({
        data: {
          id,
          title,
          description,
          template: "GENERIC",
          ownerId,
          candidateFields: resolvedCandidateFields,
          authMode: resolvedAuthMode,
          authFields: resolvedAuthFields,
          allowAbstain: resolvedAllowAbstain,
          voterFields: {
            create: (voterFields ?? []).map((f: Record<string, unknown>, i: number) => ({
              fieldName: f.fieldName,
              fieldLabel: f.fieldLabel,
              isIdentifier: f.isIdentifier ?? false,
              isRequired: f.isRequired ?? true,
              sortOrder: i,
            })),
          },
          positions: {
            create: (positions ?? []).map((p: Record<string, unknown>, i: number) => ({
              title: p.title,
              description: p.description ?? null,
              maxWinners: p.maxWinners ?? 1,
              maxVotes: p.maxVotes ?? 1,
              restrictions: p.restrictions ?? {},
              sortOrder: i,
            })),
          },
        },
        include: { voterFields: true, positions: true },
      });
      await writeAuditLog(tx, {
        action: "ELECTION_CREATED",
        userId: ownerId,
        electionId: created.id,
        metadata: {
          template: "GENERIC",
          authMode: resolvedAuthMode,
          positions: Array.isArray(positions) ? positions.length : 0,
          voterFields: Array.isArray(voterFields) ? voterFields.length : 0,
        },
      });
      return created;
    })
  );

  return NextResponse.json(election, { status: 201 });
}
