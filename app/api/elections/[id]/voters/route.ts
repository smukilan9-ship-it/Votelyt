import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeElection } from "@/lib/tenant";
import { generateToken, hashToken, fingerprintToken } from "@/lib/tokens";
import { parseSpreadsheet } from "@/lib/csv";

export const runtime = "nodejs";
export const maxDuration = 60; // bcrypt-per-voter on large CSV imports

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await authorizeElection(id);
  if (!gate.ok) return NextResponse.json({ error: gate.status === 404 ? "Not found" : "Unauthorized" }, { status: gate.status });

  const voters = await prisma.voter.findMany({
    where: { electionId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, metadata: true, hasVoted: true, votedAt: true, createdAt: true },
  });

  return NextResponse.json(voters);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await authorizeElection(id);
  if (!gate.ok) return NextResponse.json({ error: gate.status === 404 ? "Not found" : "Unauthorized" }, { status: gate.status });

  const election = await prisma.election.findUnique({
    where: { id },
    include: { voterFields: true },
  });
  if (!election) return NextResponse.json({ error: "Election not found" }, { status: 404 });

  const isTwoFields = election.authMode === "TWO_FIELDS";
  const authFields = election.authFields as string[];

  // Primary identifier — its value must be unique across the election's voters.
  const idField = election.voterFields.find((f) => f.isIdentifier)?.fieldName ?? null;
  const norm = (v: unknown) => String(v ?? "").toLowerCase().trim();

  // Set of identifier values already in the database for this election.
  async function existingIdentifierSet(): Promise<Set<string>> {
    if (!idField) return new Set();
    const existing = await prisma.voter.findMany({ where: { electionId: id }, select: { metadata: true } });
    return new Set(existing.map((v) => norm((v.metadata as Record<string, unknown>)[idField])).filter((s) => s !== ""));
  }

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseSpreadsheet(buffer);

    if (rows.length === 0) return NextResponse.json({ error: "File is empty" }, { status: 400 });

    // Validate that required auth columns are present
    if (isTwoFields) {
      const columns = Object.keys(rows[0]);
      const missing = authFields.filter((f) => !columns.includes(f));
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Missing required columns for two-field login: ${missing.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Enforce primary-identifier uniqueness: every row must carry the identifier,
    // values must be unique within the file, and must not collide with existing voters.
    if (idField) {
      if (!Object.keys(rows[0]).includes(idField)) {
        return NextResponse.json({ error: `Missing required identifier column: ${idField}` }, { status: 400 });
      }
      const seen = new Set<string>();
      const dupInFile = new Set<string>();
      const missing: number[] = [];
      rows.forEach((row, i) => {
        const val = norm(row[idField]);
        if (val === "") { missing.push(i + 2); return; } // +2: header row + 1-indexed
        if (seen.has(val)) dupInFile.add(val);
        seen.add(val);
      });
      if (missing.length > 0) {
        return NextResponse.json({ error: `Identifier "${idField}" is blank on row(s): ${missing.slice(0, 10).join(", ")}` }, { status: 400 });
      }
      const existing = await existingIdentifierSet();
      const dupInDb = [...seen].filter((v) => existing.has(v));
      if (dupInFile.size > 0 || dupInDb.length > 0) {
        const parts: string[] = [];
        if (dupInFile.size > 0) parts.push(`duplicated within the file: ${[...dupInFile].slice(0, 10).join(", ")}`);
        if (dupInDb.length > 0) parts.push(`already imported: ${dupInDb.slice(0, 10).join(", ")}`);
        return NextResponse.json({ error: `Duplicate ${idField} values — ${parts.join("; ")}` }, { status: 409 });
      }
    }

    const results: { token?: string; metadata: Record<string, string> }[] = [];

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        let tokenHash: string | null = null;
        let token: string | undefined;

        if (!isTwoFields) {
          token = generateToken();
          tokenHash = await hashToken(token);
        }

        await tx.voter.create({
          data: { electionId: id, metadata: row, tokenHash, tokenLookup: token ? fingerprintToken(token) : null },
        });

        results.push({ ...(token ? { token } : {}), metadata: row });
      }
    });

    return NextResponse.json({ imported: results.length, tokens: results }, { status: 201 });
  }

  // Single voter (JSON)
  const body = await req.json();
  const metadata = (body.metadata ?? {}) as Record<string, unknown>;

  // Identifier uniqueness for a single add.
  if (idField) {
    const val = norm(metadata[idField]);
    if (val === "") {
      return NextResponse.json({ error: `Identifier "${idField}" is required` }, { status: 400 });
    }
    const existing = await existingIdentifierSet();
    if (existing.has(val)) {
      return NextResponse.json({ error: `A voter with ${idField} "${metadata[idField]}" already exists` }, { status: 409 });
    }
  }

  let tokenHash: string | null = null;
  let token: string | undefined;

  if (!isTwoFields) {
    token = generateToken();
    tokenHash = await hashToken(token);
  }

  const voter = await prisma.voter.create({
    data: { electionId: id, metadata: metadata as object, tokenHash, tokenLookup: token ? fingerprintToken(token) : null },
  });

  return NextResponse.json({ voter, ...(token ? { token } : {}) }, { status: 201 });
}

// Clear the entire voter roll for the election. Only permitted while the
// election is in DRAFT (setup); once it has opened, the roll is frozen.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await authorizeElection(id);
  if (!gate.ok) return NextResponse.json({ error: gate.status === 404 ? "Not found" : "Unauthorized" }, { status: gate.status });

  const election = await prisma.election.findUnique({ where: { id }, select: { status: true } });
  if (!election) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (election.status !== "DRAFT") {
    return NextResponse.json({ error: "The voter roll cannot be cleared after the election has opened." }, { status: 409 });
  }

  const { count } = await prisma.voter.deleteMany({ where: { electionId: id } });
  return NextResponse.json({ cleared: count });
}
