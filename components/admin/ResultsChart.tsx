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
    return <div className="h-40 w-full animate-pulse border border-[var(--hairline)] bg-white/[0.02]" />;
  }

  if (locked || error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center border-y border-[var(--hairline)] px-6 py-24 text-center">
        <p className="mono-label mb-8">Sealed</p>
        <h2 className="max-w-3xl font-serif text-4xl leading-tight tracking-tight text-bone md:text-6xl">
          Results sealed until
          <br />
          close of polls.
        </h2>
        <p className="mt-10 max-w-md font-mono text-[0.66rem] uppercase leading-relaxed tracking-[0.16em] text-muted">
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
            <div className="mb-7 flex items-baseline justify-between border-b border-[var(--hairline)] pb-3">
              <h3 className="font-serif text-2xl tracking-tight text-bone md:text-3xl">{pos.positionTitle}</h3>
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted">
                {totalVotes} votes · {pos.maxWinners} {pos.maxWinners > 1 ? "winners" : "winner"}
              </span>
            </div>

            <div className="space-y-7">
              {pos.candidates.map((c, i) => {
                const pct = totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0;
                const w = (c.votes / maxVotes) * 100;
                return (
                  <div key={c.id} className="r-row">
                    <div className="mb-2 flex items-baseline justify-between gap-4">
                      <div className="r-name flex items-baseline gap-4">
                        <span className="font-mono text-[0.7rem] text-muted">{String(c.rank ?? i + 1).padStart(2, "0")}</span>
                        <span
                          className="font-serif text-xl tracking-tight md:text-2xl"
                          style={{ color: c.isWinner ? "var(--accent)" : "var(--bone)" }}
                        >
                          {c.name}
                        </span>
                        {c.isWinner && (
                          <span className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-accent">● Elected</span>
                        )}
                      </div>
                      <div className="r-num flex items-baseline gap-4">
                        <span className="font-mono text-sm tabular-nums text-bone">{c.votes}</span>
                        <span className="w-10 text-right font-mono text-[0.7rem] tabular-nums text-muted">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-px w-full bg-[var(--hairline)]">
                      <div
                        className="r-bar h-px"
                        style={{ width: `${w}%`, background: c.isWinner ? "var(--accent)" : "var(--bone)" }}
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
