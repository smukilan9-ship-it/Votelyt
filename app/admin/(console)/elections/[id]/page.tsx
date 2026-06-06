import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, ownerScope } from "@/lib/tenant";
import { ElectionConsole } from "./ElectionConsole";

export const dynamic = "force-dynamic";

export default async function ElectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");

  const election = await prisma.election.findFirst({
    where: { id, ...ownerScope(user) },
    include: {
      voterFields: { orderBy: { sortOrder: "asc" } },
      positions: {
        orderBy: { sortOrder: "asc" },
        include: { candidates: true },
      },
      _count: { select: { voters: true } },
    },
  });

  if (!election) notFound();

  return <ElectionConsole election={JSON.parse(JSON.stringify(election))} />;
}
