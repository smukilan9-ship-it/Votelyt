import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public endpoint — no admin auth. Returns only what the voter login page needs.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const election = await prisma.election.findUnique({
    where: { id },
    include: {
      voterFields: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!election) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const authFields = election.authFields as string[];

  // Map field names to their labels for the login UI
  const authFieldDefs = authFields.map((fieldName) => {
    const def = election.voterFields.find((f) => f.fieldName === fieldName);
    return { fieldName, fieldLabel: def?.fieldLabel ?? fieldName };
  });

  return NextResponse.json({
    id: election.id,
    title: election.title,
    status: election.status,
    authMode: election.authMode,
    authFields: authFieldDefs,
    allowAbstain: election.allowAbstain,
  });
}
