"use client";
import { useState, useEffect, useRef } from "react";
import gsap from "gsap";

interface CandidateResult { id: string; name: string; votes: number; rank?: number; isWinner: boolean }
interface PositionResult { positionId: string; positionTitle: string; maxWinners: number; candidates: CandidateResult[] }

export function ResultsChart({ electionId, locked }: { electionId: string; locked: boolean }) {
  const [results, setResults] = useState<PositionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!locked);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (locked) return;
    fetch(`/api/elections/${electionId}/results`)
      .then(async (res) => {
        if (!res.ok) setError((await res.json()).error);
        else setResults(await res.json());
      })
      .finally(() => setLoading(false));
  }, [electionId, locked]);

  // GSAP reveal: bars draw left→right in finish order, names typeset as each lands.
  useEffect(() => {
    if (!results || !root.current) return;
    const ctx = gsap.context(() => {
      gsap.set(".r-bar", { scaleX: 0, transformOrigin: "left" });
      gsap.set(".r-name, .r-num", { opacity: 0, y: 8 });
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      const groups = gsap.utils.toArray<HTMLElement>(".r-row");
      groups.forEach((row) => {
        tl.to(row.querySelector(".r-name"), { opacity: 1, y: 0, duration: 0.4 }, "+=0.02")
          .to(row.querySelector(".r-bar"), { scaleX: 1, duration: 0.7 }, "<")
          .to(row.querySelector(".r-num"), { opacity: 1, y: 0, duration: 0.4 }, "<0.25");
      });
    }, root);
    return () => ctx.revert();
  }, [results]);

  if (loading) {
    return <div className="glass rounded-2xl p-8"><div className="h-40 w-full animate-pulse rounded-xl bg-white/[0.03]" /></div>;
  }

  if (locked || error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mb-8 h-16 w-16 rounded-full glass-strong flex items-center justify-center">
          <svg width="28" height="28" fill="none" stroke="#4A9EFF" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0-8v4m9-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="sans-label mb-6">Sealed</p>
        <h2 className="max-w-2xl font-sans font-extrabold text-4xl leading-tight tracking-tight text-white md:text-5xl">
          Results sealed until
          <br />
          <span className="accent-gradient-text">close of polls.</span>
        </h2>
        <p className="mt-8 max-w-md text-[0.95rem] leading-relaxed text-white/45">
          {error ?? "No partial counts are revealed. The tally unseals the moment the administrator closes this election."}
        </p>
      </div>
    );
  }

  if (!results) return null;

  return (
    <div ref={root} className="space-y-16">
      {results.map((pos) => {
        const totalVotes = pos.candidates.reduce((s, c) => s + c.votes, 0);
        const maxVotes = Math.max(...pos.candidates.map((c) => c.votes), 1);
        return (
          <section key={pos.positionId}>
            <div className="mb-7 flex items-baseline justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-sans font-bold text-2xl tracking-tight text-white md:text-3xl">{pos.positionTitle}</h3>
              <span className="font-sans text-[0.82rem] text-white/45">
                {totalVotes} votes · {pos.maxWinners} {pos.maxWinners > 1 ? "winners" : "winner"}
              </span>
            </div>

            <div className="space-y-6">
              {pos.candidates.map((c, i) => {
                const pct = totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0;
                const w = (c.votes / maxVotes) * 100;
                return (
                  <div key={c.id} className="r-row">
                    <div className="mb-2.5 flex items-baseline justify-between gap-4">
                      <div className="r-name flex items-baseline gap-3.5">
                        <span className="font-mono text-[0.8rem] tabular-nums text-white/35">{String(c.rank ?? i + 1).padStart(2, "0")}</span>
                        <span
                          className="font-sans font-semibold text-[1.05rem] tracking-tight md:text-xl"
                          style={{ color: c.isWinner ? "#4A9EFF" : "#fff" }}
                        >
                          {c.name}
                        </span>
                        {c.isWinner && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#4A9EFF]/25 bg-[#4A9EFF]/[0.08] px-2 py-0.5 font-sans text-[0.72rem] font-medium text-[#4A9EFF]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#4A9EFF]" />Elected
                          </span>
                        )}
                      </div>
                      <div className="r-num flex items-baseline gap-3">
                        <span className="font-mono text-[0.95rem] tabular-nums text-white">{c.votes}</span>
                        <span className="w-10 text-right font-mono text-[0.8rem] tabular-nums text-white/55">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="r-bar h-2 rounded-full"
                        style={{ width: `${w}%`, background: c.isWinner ? "linear-gradient(90deg, #4A9EFF, #89AACC)" : "rgba(255,255,255,0.25)" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
