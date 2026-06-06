"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AuroraBackground } from "@/components/ui/AuroraBackground";

interface CandidateResult { id: string; name: string; photoUrl?: string | null; votes: number; rank?: number; isWinner: boolean; }
interface PositionResult { positionId: string; positionTitle: string; maxWinners: number; candidates: CandidateResult[]; }
interface RankedGroup { rank: number; votes: number; candidates: CandidateResult[]; }

function CountUp({ target, duration = 1.5 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / (duration * 1000), 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * ease));
      if (t < 1) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return <span className="tabular">{val}</span>;
}

/* confetti particle that falls from top — drift/duration are passed in (computed
   once, deterministically) so the component is pure and SSR/CSR-stable. */
interface ConfettiProps { delay: number; x: number; color: string; drift: number; duration: number }
function ConfettiPiece({ delay, x, color, drift, duration }: ConfettiProps) {
  return (
    <motion.div
      className="absolute pointer-events-none rounded-sm"
      style={{
        left: `${x}%`, top: -10,
        width: 6, height: 10,
        background: color,
        originX: 0.5,
      }}
      initial={{ y: -20, opacity: 1, rotate: 0, x: 0 }}
      animate={{ y: 300, opacity: [1, 1, 0], rotate: 720, x: [drift] }}
      transition={{ duration, delay, ease: "easeIn" }}
    />
  );
}

function WinnerConfetti({ active }: { active: boolean }) {
  const [pieces] = useState<ConfettiProps[]>(() =>
    Array.from({ length: 24 }, (_, i) => ({
      delay: i * 0.08,
      x: 20 + (i * 2.5) % 60,
      color: ["#4A9EFF", "#89AACC", "#7DC4FF", "#ffffff", "#2B7FE0", "#4A9EFF88"][i % 6],
      drift: ((i * 17) % 60) - 30, // -30..29, mimics (random-0.5)*60
      duration: 2.5 + ((i * 11) % 10) / 10, // 2.5..3.4s
    }))
  );
  if (!active) return null;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map((p, i) => <ConfettiPiece key={i} {...p} />)}
    </div>
  );
}

function PodiumBlock({
  rank, candidates, delay, totalVotes,
}: {
  rank: 1 | 2 | 3;
  candidates: CandidateResult[] | undefined;
  delay: number;
  totalVotes: number;
}) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (rank === 1 && candidates?.length) {
      const t = setTimeout(() => setShowConfetti(true), (delay + 1.2) * 1000);
      return () => clearTimeout(t);
    }
  }, [rank, candidates, delay]);

  if (!candidates?.length) return <div className="flex-1" />;

  const lead = candidates[0];
  const isTie = candidates.length > 1;
  const podiumHeights = { 1: 180, 2: 120, 3: 85 };
  const h = podiumHeights[rank];
  const pct = totalVotes > 0 ? Math.round((lead.votes / totalVotes) * 100) : 0;
  const initialsFor = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const medals = {
    1: { bg: "linear-gradient(135deg, #FFD700, #FFA500)", text: "#000", label: "1st" },
    2: { bg: "linear-gradient(135deg, #C0C0C0, #A0A0A0)", text: "#000", label: "2nd" },
    3: { bg: "linear-gradient(135deg, #CD7F32, #A0522D)", text: "#fff", label: "3rd" },
  };
  const medal = medals[rank];

  return (
    <div className={`flex flex-1 flex-col items-center ${rank === 2 ? "order-first" : rank === 3 ? "order-last" : ""}`}>
      <motion.div
        className="relative mb-4 flex flex-col items-center w-full"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: delay + 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* confetti for winner */}
        <WinnerConfetti active={showConfetti} />

        {/* photos */}
        <motion.div
          className={`relative mb-3 grid place-items-center ${rank === 1 ? "min-h-28" : "min-h-20"}`}
          animate={rank === 1 ? {
            boxShadow: [
              "0 0 0 2px rgba(74,158,255,0.5), 0 0 20px rgba(74,158,255,0.3)",
              "0 0 0 3px rgba(74,158,255,0.8), 0 0 50px rgba(74,158,255,0.5), 0 0 90px rgba(74,158,255,0.2)",
              "0 0 0 2px rgba(74,158,255,0.5), 0 0 20px rgba(74,158,255,0.3)",
            ]
          } : {
            boxShadow: "0 0 0 1px rgba(255,255,255,0.1)"
          }}
          transition={rank === 1 ? { duration: 2.5, repeat: Infinity, ease: "easeInOut" } : {}}
        >
          <div className={`flex flex-wrap items-center justify-center ${isTie ? "-space-x-3" : ""}`}>
            {candidates.slice(0, 4).map((candidate) => (
              <div
                key={candidate.id}
                className={`relative overflow-hidden rounded-2xl border border-black/40 bg-white/[0.04] ${
                  rank === 1 ? "h-20 w-20 md:h-24 md:w-24" : "h-16 w-16 md:h-20 md:w-20"
                }`}
              >
                {candidate.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={candidate.photoUrl}
                    alt={candidate.name}
                    className="h-full w-full object-cover"
                    style={{ filter: rank === 1 ? "contrast(1.1) brightness(0.9)" : "grayscale(0.3) contrast(1.05) brightness(0.85)" }}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <span className="font-mono text-xl text-white/30">{initialsFor(candidate.name)}</span>
                  </div>
                )}
              </div>
            ))}
            {candidates.length > 4 && (
              <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-black/40 bg-white/[0.08] font-mono text-[0.65rem] text-white/50">
                +{candidates.length - 4}
              </div>
            )}
          </div>
          {rank === 1 && (
            <div className="absolute inset-0 accent-gradient opacity-10 rounded-2xl" />
          )}
        </motion.div>

        {/* names */}
        <div className={`mb-1 px-1 text-center font-sans font-bold leading-tight tracking-tight text-white ${rank === 1 ? "text-[1rem] md:text-[1.15rem]" : "text-[0.82rem] md:text-[0.95rem]"}`}>
          {candidates.map((candidate) => (
            <p key={candidate.id}>{candidate.name}</p>
          ))}
        </div>
        {isTie && (
          <p className="mb-2 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-[#89AACC]">
            Tied for {rank}
          </p>
        )}

        {/* vote count */}
        <p className="font-mono text-[0.62rem] tracking-[0.14em] mb-2"
          style={{ color: rank === 1 ? "#89AACC" : "rgba(255,255,255,0.3)" }}>
          <CountUp target={lead.votes} duration={1.2 + delay} />
          <span className="ml-1 opacity-70">votes{isTie ? " each" : ""} · {pct}%</span>
        </p>

        {/* medal */}
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full font-mono text-[0.62rem] font-bold shadow-lg"
          style={{ background: medal.bg, color: medal.text }}
        >
          {rank}
        </div>

        {/* vote bar */}
        <div className="mt-3 w-full px-2">
          <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: rank === 1 ? "linear-gradient(90deg, #4A9EFF, #89AACC)" : "rgba(255,255,255,0.2)" }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.2, delay: delay + 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      </motion.div>

      {/* podium column — 3D-style with gradient */}
      <motion.div
        className="w-full rounded-t-xl overflow-hidden relative"
        initial={{ scaleY: 0, transformOrigin: "bottom" }}
        animate={{ scaleY: 1, transformOrigin: "bottom" }}
        transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
        style={{ height: h }}
      >
        {rank === 1 ? (
          <div className="absolute inset-0 accent-gradient" />
        ) : (
          <div className="absolute inset-0 bg-white/[0.06]" />
        )}
        {/* top edge glow */}
        <div className="absolute top-0 inset-x-0 h-px" style={{
          background: rank === 1 ? "rgba(137,170,204,0.6)" : "rgba(255,255,255,0.15)"
        }} />
        {/* 3D shading */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(90deg, rgba(0,0,0,0.15) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.2) 100%)"
        }} />
        {/* rank label */}
        <p className="absolute bottom-3 left-0 right-0 text-center font-mono text-[0.55rem] tracking-[0.2em] uppercase"
          style={{ color: rank === 1 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)" }}>
          {medal.label}
        </p>
      </motion.div>
    </div>
  );
}

function PositionPodium({ pos, index }: { pos: PositionResult; index: number }) {
  const sorted = [...pos.candidates].sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
  const groups = sorted.reduce<RankedGroup[]>((acc, candidate, sortedIndex) => {
    const last = acc[acc.length - 1];
    if (last && last.votes === candidate.votes) {
      last.candidates.push(candidate);
      return acc;
    }
    acc.push({ rank: candidate.rank ?? sortedIndex + 1, votes: candidate.votes, candidates: [candidate] });
    return acc;
  }, []);
  const first = groups.find((group) => group.rank === 1);
  const second = groups.find((group) => group.rank === 2);
  const third = groups.find((group) => group.rank === 3);
  const remaining = groups.filter((group) => group.rank > 3);
  const totalVotes = pos.candidates.reduce((s, c) => s + c.votes, 0);

  return (
    <motion.section
      className="mb-24"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.15 }}
    >
      <div className="mb-12 text-center">
        <p className="mono-label mb-3">{pos.positionTitle}</p>
        <p className="font-mono text-[0.6rem] tracking-[0.2em] text-white/25">
          {totalVotes} total votes · {pos.maxWinners} winner{pos.maxWinners > 1 ? "s" : ""}
        </p>
      </div>

      {/* podium — 2nd | 1st | 3rd order */}
      <div className="flex items-end gap-4 justify-center max-w-xl mx-auto">
        <PodiumBlock rank={2} candidates={second?.candidates} delay={0.2} totalVotes={totalVotes} />
        <PodiumBlock rank={1} candidates={first?.candidates} delay={0} totalVotes={totalVotes} />
        <PodiumBlock rank={3} candidates={third?.candidates} delay={0.35} totalVotes={totalVotes} />
      </div>

      {/* remaining candidates */}
      {remaining.length > 0 && (
        <div className="mt-10 space-y-2 max-w-md mx-auto">
          <p className="mono-label mb-4 text-center text-white/30">Other candidates</p>
          {remaining.flatMap((group) => group.candidates.map((c) => ({ ...c, rank: group.rank }))).map((c, i) => {
            const pct = totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0;
            return (
              <motion.div
                key={c.id}
                className="glass rounded-xl flex items-center gap-4 px-4 py-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 + i * 0.1 }}
              >
                <span className="font-mono text-[0.6rem] text-white/20 w-6">{c.rank}</span>
                <span className="font-sans flex-1 text-white/70">{c.name}</span>
                <div className="hidden sm:flex items-center gap-2 w-24">
                  <div className="flex-1 h-0.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-white/20"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 1.2 + i * 0.1 }}
                    />
                  </div>
                </div>
                <span className="font-mono text-[0.65rem] tabular text-white/30 w-16 text-right">
                  {c.votes} v
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}

export function ResultsPodium({ electionId, locked }: { electionId: string; locked: boolean }) {
  const [results, setResults] = useState<PositionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!locked);

  useEffect(() => {
    if (locked) return;
    fetch(`/api/elections/${electionId}/results`)
      .then(async (res) => {
        if (!res.ok) setError((await res.json()).error);
        else setResults(await res.json());
      })
      .finally(() => setLoading(false));
  }, [electionId, locked]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <span className="font-mono text-[0.65rem] tracking-[0.3em] text-white/30 animate-pulse">TALLYING RESULTS…</span>
      </div>
    );
  }

  if (locked || error) {
    return (
      <div className="relative flex min-h-[50vh] flex-col items-center justify-center px-6 py-24 text-center overflow-hidden">
        <AuroraBackground variant="blue" intensity={0.5} />
        <div className="relative z-10">
          <motion.div
            className="mb-8 h-16 w-16 rounded-full glass-strong flex items-center justify-center mx-auto"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <svg width="28" height="28" fill="none" stroke="#4A9EFF" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0-8v4m9-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </motion.div>
          <p className="mono-label mb-6">Sealed</p>
          <h2 className="max-w-2xl font-sans font-extrabold text-4xl leading-tight tracking-tight text-white md:text-5xl">
            Results sealed until
            <br />
            <span className="accent-gradient-text">close of polls.</span>
          </h2>
          <p className="mt-8 max-w-md font-mono text-[0.65rem] uppercase leading-relaxed tracking-[0.16em] text-white/25">
            {error ?? "No partial counts are revealed. The tally unseals the moment the administrator closes this election."}
          </p>
        </div>
      </div>
    );
  }

  if (!results) return null;

  return (
    <div className="relative overflow-hidden">
      <AuroraBackground variant="blue" intensity={0.4} />
      <div className="relative z-10 pt-4">
        {results.map((pos, i) => (
          <PositionPodium key={pos.positionId} pos={pos} index={i} />
        ))}
      </div>
    </div>
  );
}
