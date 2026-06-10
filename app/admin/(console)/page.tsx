import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, ownerScope } from "@/lib/tenant";
import { Ticker } from "@/components/admin/Ticker";

export const dynamic = "force-dynamic";

const pad2 = (n: number) => String(n).padStart(2, "0");

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");

  const elections = await prisma.election.findMany({
    where: { ...ownerScope(user) },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { voters: true, candidates: true, positions: true } } },
  });

  // Turnout aggregates scoped to this tenant's elections.
  const electionIds = elections.map((e) => e.id);
  const voterScope = { electionId: { in: electionIds } };
  const [totalVoters, totalVoted, votedGroups] = await Promise.all([
    prisma.voter.count({ where: voterScope }),
    prisma.voter.count({ where: { ...voterScope, hasVoted: true } }),
    prisma.voter.groupBy({ by: ["electionId"], where: { ...voterScope, hasVoted: true }, _count: { _all: true } }),
  ]);
  const votedByElection = new Map(votedGroups.map((g) => [g.electionId, g._count._all]));
  const activeCount = elections.filter((e) => e.status === "ACTIVE").length;
  const turnout = totalVoters > 0 ? Math.round((totalVoted / totalVoters) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-32">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="mb-12 flex items-end justify-between anim-slide-up md:mb-20" style={{ animationDelay: "0ms" }}>
        <div>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-white/55 mb-5">
            Console · Overview
          </p>
          <h1
            className="font-sans font-extrabold text-white tracking-tight leading-[0.92]"
            style={{ fontSize: "clamp(3.5rem, 9vw, 7rem)" }}
          >
            Elections.
          </h1>
        </div>
        <Link
          href="/admin/elections/new"
          className="hidden md:inline-flex items-center gap-2 rounded-full glass px-7 py-3.5 text-[0.9rem] font-medium text-white/60 hover:text-white hover:border-[#4A9EFF]/40 transition-all duration-300"
        >
          New Election ⟶
        </Link>
      </header>

      {/* ── Stat cards ─────────────────────────────────────── */}
      <div className="mb-16 grid grid-cols-2 gap-4 sm:gap-5 md:mb-24 md:grid-cols-4">
        {[
          { label: "Elections", value: elections.length },
          { label: "Open now", value: activeCount, accent: activeCount > 0 },
          { label: "Turnout", value: turnout, suffix: "%", ring: true },
          { label: "Ballots cast", value: totalVoted },
        ].map((card, i) => (
          <div key={card.label} className="anim-slide-up" style={{ animationDelay: `${80 + i * 80}ms` }}>
            <StatCard {...card} />
          </div>
        ))}
      </div>

      {/* ── Election list ───────────────────────────────────── */}
      <div className="anim-slide-up" style={{ animationDelay: "420ms" }}>
        <div className="mb-8 flex items-center justify-between">
          <h2 className="font-sans font-semibold text-xl text-white/70">
            All elections
            <span className="ml-3 font-mono text-sm text-white/50">{pad2(elections.length)}</span>
          </h2>
          <Link
            href="/admin/elections/new"
            className="md:hidden font-mono text-[0.65rem] uppercase tracking-[0.18em] text-white/40 hover:text-white transition-colors"
          >
            New ⟶
          </Link>
        </div>

        {elections.length === 0 ? (
          <div className="rounded-3xl glass py-20 px-5 text-center md:py-32">
            <p className="text-xl font-medium text-white/60 mb-6">No elections yet.</p>
            <Link
              href="/admin/elections/new"
              className="inline-flex items-center gap-2 rounded-full accent-gradient px-8 py-4 text-[0.9rem] font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Create the first ⟶
            </Link>
          </div>
        ) : (
          <div className="rounded-3xl glass overflow-hidden">
            {elections.map((el, i) => {
              const voted = votedByElection.get(el.id) ?? 0;
              const pct = el._count.voters > 0 ? Math.round((voted / el._count.voters) * 100) : 0;
              const live = el.status === "ACTIVE";
              const ended = el.status === "ENDED";
              return (
                <Link
                  key={el.id}
                  href={`/admin/elections/${el.id}`}
                  className="group flex items-center gap-4 border-b border-white/[0.05] last:border-b-0 px-5 py-5 hover:bg-white/[0.04] transition-all duration-300 anim-slide-up md:gap-6 md:px-8 md:py-6"
                  style={{ animationDelay: `${500 + i * 60}ms` }}
                >
                  {/* index */}
                  <span className="shrink-0 w-8 font-mono text-[0.62rem] text-white/20">{pad2(i + 1)}</span>

                  {/* live indicator */}
                  {live && <span className="shrink-0 h-2 w-2 rounded-full bg-[#4A9EFF] animate-pulse" />}

                  {/* title */}
                  <div className="min-w-0 flex-1">
                    <p className="text-[1.15rem] font-semibold text-white truncate group-hover:text-[#4A9EFF] transition-colors duration-200">
                      {el.title}
                    </p>
                    <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-white/55">
                      {el._count.positions} positions · {el._count.candidates} candidates · {el._count.voters} voters
                    </p>
                  </div>

                  {/* status chip */}
                  <span
                    className={`hidden md:inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-[0.68rem] font-mono uppercase tracking-[0.12em] ${
                      live
                        ? "bg-[#4A9EFF]/10 text-[#4A9EFF] border border-[#4A9EFF]/20"
                        : ended
                        ? "bg-white/[0.04] text-white/55 border border-white/[0.08]"
                        : "bg-white/[0.03] text-white/55 border border-white/[0.06]"
                    }`}
                  >
                    {live && <span className="h-1.5 w-1.5 rounded-full bg-[#4A9EFF] animate-pulse" />}
                    {live ? "Open" : ended ? "Close" : "Draft"}
                  </span>

                  {/* turnout ring */}
                  <div className="hidden md:flex items-center gap-3 shrink-0">
                    <div className="relative h-10 w-10">
                      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="14" fill="none" stroke="#4A9EFF" strokeWidth="3"
                          strokeDasharray={`${2 * Math.PI * 14}`}
                          strokeDashoffset={`${2 * Math.PI * 14 * (1 - pct / 100)}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center font-mono text-[0.48rem] text-white/65">{pct}%</span>
                    </div>
                  </div>

                  <span className="shrink-0 font-mono text-[0.62rem] tracking-[0.1em] text-white/50 hidden md:inline">
                    {new Date(el.createdAt).toLocaleDateString("en-CA")}
                  </span>

                  <span className="shrink-0 font-mono text-[0.75rem] text-white/0 group-hover:text-white/30 transition-colors duration-200">⟶</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label, value, suffix = "", accent = false, ring = false,
}: { label: string; value: number; suffix?: string; accent?: boolean; ring?: boolean }) {
  return (
    <div className="relative rounded-3xl glass px-6 py-8 overflow-hidden group card-lift md:px-8 md:py-10">
      {accent && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#4A9EFF]/[0.08] to-transparent rounded-3xl" />
      )}
      {accent && (
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#4A9EFF]/50 to-transparent" />
      )}
      <p className="font-sans text-[0.8rem] font-medium text-white/60 mb-5 relative">{label}</p>
      <div className="relative flex items-center gap-4">
        {ring && (
          <svg className="-rotate-90 shrink-0" viewBox="0 0 48 48" width="54" height="54">
            <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
            <circle
              cx="24" cy="24" r="19" fill="none" stroke="#4A9EFF" strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 19}`}
              strokeDashoffset={`${2 * Math.PI * 19 * (1 - value / 100)}`}
              strokeLinecap="round"
            />
          </svg>
        )}
        <p
          className={`font-sans font-extrabold tracking-tight leading-none relative ${accent ? "text-[#4A9EFF]" : "text-white"}`}
          style={{ fontSize: "clamp(2.2rem, 5vw, 3.8rem)" }}
        >
          <Ticker value={value} suffix={suffix} />
        </p>
      </div>
    </div>
  );
}
