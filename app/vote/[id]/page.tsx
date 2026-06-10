"use client";
import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { TopBar, Footer } from "@/components/ui/Chrome";
import { HoldToConfirm } from "@/components/vote/HoldToConfirm";
import { AuroraBackground } from "@/components/ui/AuroraBackground";

interface Candidate { id: string; name: string; description: string | null; photoUrl: string | null; }
interface BallotPosition {
  positionId: string; title: string; description: string | null;
  maxVotes: number; maxWinners: number; candidates: Candidate[];
}
interface BallotData { voterId: string; voterName: string | null; ballot: BallotPosition[]; }
interface ElectionConfig {
  id: string; title: string; status: string;
  authMode: "ACCESS_CODE" | "TWO_FIELDS";
  authFields: { fieldName: string; fieldLabel: string }[];
  allowAbstain: boolean;
}

const pad2 = (n: number) => String(n + 1).padStart(2, "0");

/* floating ambient particle — all visual props are passed in (computed once,
   deterministically) so the component is pure and SSR/CSR render identically. */
interface ParticleProps { delay: number; x: number; size: number; color: string; duration: number }
function Particle({ delay, x, size, color, duration }: ParticleProps) {
  return (
    <motion.div
      className="pointer-events-none absolute rounded-full"
      style={{
        left: `${x}%`,
        bottom: "-10px",
        width: size,
        height: size,
        background: color,
      }}
      initial={{ y: 0, opacity: 0 }}
      animate={{ y: -140, opacity: [0, 0.7, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeOut" }}
    />
  );
}

export default function VotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: electionId } = use(params);
  const router = useRouter();

  const [config, setConfig] = useState<ElectionConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const [step, setStep] = useState<"auth" | "ballot" | "review" | "done">("auth");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [authStatus, setAuthStatus] = useState<"READY" | "VERIFYING" | "DENIED" | "AUTHENTICATED">("READY");
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [ballotData, setBallotData] = useState<BallotData | null>(null);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // particles — computed once, deterministically (no Math.random → no hydration
  // mismatch), held in state so we never read a ref during render.
  const [particles] = useState<ParticleProps[]>(() =>
    Array.from({ length: 18 }, (_, i) => ({
      delay: i * 0.7,
      x: (i * 37 + 11) % 100,
      size: 2 + ((i * 13) % 5), // 2–6px
      color: i % 2 === 0 ? "rgba(74,158,255,0.4)" : "rgba(137,170,204,0.3)",
      duration: 4 + ((i * 7) % 30) / 10, // 4.0–6.9s
    }))
  );

  useEffect(() => {
    fetch(`/api/elections/${electionId}/public`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
          if (data.authMode === "TWO_FIELDS") {
            const init: Record<string, string> = {};
            data.authFields.forEach((f: { fieldName: string }) => { init[f.fieldName] = ""; });
            setCredentials(init);
          } else {
            setCredentials({ access_code: "" });
          }
        } else {
          setConfigError("Election not found.");
        }
      })
      .catch(() => setConfigError("Could not load election."));
  }, [electionId]);

  // Arrow-key navigation across contests.
  useEffect(() => {
    if (step !== "ballot" || !ballotData) return;
    const onKey = (e: KeyboardEvent) => {
      const ct = ballotData.ballot;
      if (e.key === "ArrowLeft") setCurrent((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") {
        const cur = ct[current];
        const sel = selections[cur.positionId] ?? [];
        const blocked = config?.allowAbstain === false && cur.candidates.length > 0 && sel.length === 0;
        if (!blocked && current < ct.length - 1) setCurrent((i) => i + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, ballotData, current, selections, config]);

  // Reset the whole flow back to the authentication screen for the next voter.
  // Navigating to the same /vote/[id] URL does NOT remount this client component,
  // so the kiosk only truly resets by clearing per-voter state here. Credentials
  // and ballot data are wiped so nothing leaks between voters; `router.refresh()`
  // revalidates in case the admin has since closed the election.
  const restartForNextVoter = useCallback(() => {
    setStep("auth");
    setAuthStatus("READY");
    setAuthMsg(null);
    setBallotData(null);
    setSelections({});
    setCurrent(0);
    setSubmitting(false);
    setCountdown(5);
    setCredentials(
      config?.authMode === "TWO_FIELDS"
        ? Object.fromEntries(config.authFields.map((f) => [f.fieldName, ""]))
        : { access_code: "" }
    );
    router.refresh();
  }, [config, router]);

  // 5-second countdown after a vote, then auto-reset for the next voter. Both
  // the decrement and the reset happen inside the timer callback (an async
  // event, not the render/effect body), so navigation/state updates never run
  // while VotePage is rendering — which is what caused the Router error before.
  useEffect(() => {
    if (step !== "done") return;
    const t = setTimeout(() => {
      if (countdown <= 1) restartForNextVoter();
      else setCountdown((c) => c - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [step, countdown, restartForNextVoter]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthStatus("VERIFYING");
    setAuthMsg(null);
    try {
      const res = await fetch("/api/vote/ballot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ electionId, credentials }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthStatus("AUTHENTICATED");
        const init: Record<string, string[]> = {};
        data.ballot.forEach((p: BallotPosition) => { init[p.positionId] = []; });
        setSelections(init);
        setTimeout(() => { setBallotData(data); setStep("ballot"); }, 450);
      } else {
        setAuthStatus("DENIED");
        setAuthMsg(data.error ?? "Credentials not recognised");
      }
    } catch {
      setAuthStatus("DENIED");
      setAuthMsg("Network error");
    }
  };

  const toggleCandidate = (positionId: string, candidateId: string, maxVotes: number) => {
    setSelections((prev) => {
      const cur = prev[positionId] ?? [];
      if (cur.includes(candidateId)) return { ...prev, [positionId]: cur.filter((x) => x !== candidateId) };
      if (cur.length >= maxVotes) {
        if (maxVotes === 1) return { ...prev, [positionId]: [candidateId] };
        return prev;
      }
      return { ...prev, [positionId]: [...cur, candidateId] };
    });
  };

  const handleSubmit = async () => {
    if (!ballotData) return;
    const sel = ballotData.ballot.map((pos) => ({
      positionId: pos.positionId,
      candidateIds: selections[pos.positionId] ?? [],
    }));
    setSubmitting(true);
    try {
      const res = await fetch("/api/vote/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ electionId, credentials, selections: sel }),
      });
      const data = await res.json();
      if (res.ok) {
        setCountdown(5);
        setStep("done");
      } else {
        setStep("review");
        setAuthMsg(data.error ?? "Failed to submit");
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ── loading/error states ────────────────────────────────── */
  if (configError) {
    return (
      <Shell title="Election Software">
        <div className="grid min-h-[70vh] place-items-center px-6">
          <p className="font-sans font-medium text-sm uppercase tracking-[0.2em] text-red-400">{configError}</p>
        </div>
      </Shell>
    );
  }

  if (!config) {
    return (
      <Shell title="Election Software">
        <div className="grid min-h-[70vh] place-items-center">
          <span className="font-sans font-medium text-[0.65rem] tracking-[0.3em] text-white/55 animate-pulse">LOADING</span>
        </div>
      </Shell>
    );
  }

  if (config.status !== "ACTIVE") {
    return (
      <Shell title={config.title} status={config.status}>
        <div className="relative grid min-h-[70vh] place-items-center px-6 text-center overflow-hidden">
          <AuroraBackground variant="blue" intensity={0.7} />
          <div className="relative z-10">
            <p className="sans-label mb-6">
              {config.status === "ENDED" ? "Polls closed" : "Not yet open"}
            </p>
            <h1 className="font-sans font-bold text-[2.5rem] tracking-tight text-white md:text-[4rem]">
              {config.status === "ENDED" ? "This election has closed." : "This election has not opened."}
            </h1>
          </div>
        </div>
      </Shell>
    );
  }

  /* ── done — vote confirmed ───────────────────────────────── */
  if (step === "done") {
    return (
      <Shell title={config.title} status={config.status} id={config.id}>
        <div className="relative grid min-h-[80vh] place-items-center px-6 text-center overflow-hidden">
          <AuroraBackground variant="mixed" intensity={1} />

          {/* ambient particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p, i) => <Particle key={i} {...p} />)}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 max-w-2xl"
          >
            {/* checkmark + success bloom */}
            <div className="relative mx-auto mb-10 flex h-20 w-20 items-center justify-center">
              <span
                className="success-bloom pointer-events-none absolute inset-0 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(74,158,255,0.55), transparent 70%)" }}
                aria-hidden="true"
              />
            <motion.div
              className="relative flex h-20 w-20 items-center justify-center rounded-full"
              style={{ background: "linear-gradient(135deg, rgba(74,158,255,0.2), rgba(137,170,204,0.15))", border: "1px solid rgba(74,158,255,0.3)", boxShadow: "0 0 40px rgba(74,158,255,0.35)" }}
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.6, delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <motion.svg width="36" height="36" viewBox="0 0 36 36" fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.6 }}>
                <motion.path
                  d="M8 18l7 7 13-13" stroke="#4A9EFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                />
              </motion.svg>
            </motion.div>
            </div>

            <motion.p
              className="sans-label mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Submission complete
            </motion.p>

            <motion.h1
              className="font-sans font-extrabold leading-[1.05] tracking-tight text-white mb-2"
              style={{ fontSize: "clamp(2.8rem, 8vw, 5rem)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              Vote
              <br />
              <span className="accent-gradient-text">submitted.</span>
            </motion.h1>

            <motion.p
              className="mx-auto mt-6 max-w-md text-[1.05rem] leading-relaxed text-white/70"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              Your response has been recorded for this election.
            </motion.p>

            <motion.div
              className="mx-auto mt-8 max-w-md rounded-2xl glass p-5 text-left"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-[#4A9EFF]" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2a7 7 0 00-7 7v3.5l-1.4 2.8A1 1 0 004.5 17H9a3 3 0 006 0h4.5a1 1 0 00.9-1.7L19 12.5V9a7 7 0 00-7-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </span>
                <p className="text-sm leading-relaxed text-white/65">
                  This screen does not reveal your selected candidate. Return this
                  device to the election admin or close the page.
                </p>
              </div>
            </motion.div>

            {/* countdown redirect */}
            <motion.div
              className="mt-8 flex flex-col items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <p className="font-sans font-medium text-[0.65rem] uppercase tracking-[0.2em] text-white/55">
                Next voter in {countdown}s
              </p>
              {/* countdown ring */}
              <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
                <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                <motion.circle
                  cx="24" cy="24" r="20" fill="none" stroke="#4A9EFF" strokeWidth="2"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  initial={{ strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 20 }}
                  transition={{ duration: 5, ease: "linear" }}
                  strokeLinecap="round"
                />
              </svg>
              <button
                onClick={restartForNextVoter}
                className="font-sans font-medium text-[0.62rem] uppercase tracking-[0.2em] text-[#4A9EFF] hover:opacity-70 transition-opacity"
              >
                Vote now ⟶
              </button>
            </motion.div>
          </motion.div>
        </div>
      </Shell>
    );
  }

  /* ── auth ───────────────────────────────────────────────── */
  if (step === "auth") {
    const isTwoFields = config.authMode === "TWO_FIELDS";
    const statusText =
      authStatus === "VERIFYING" ? "Checking…"
      : authStatus === "AUTHENTICATED" ? "Verified"
      : authStatus === "DENIED" ? (authMsg ?? "That code wasn't recognized. Check it and try again.")
      : "Ready";
    const statusColor =
      authStatus === "DENIED" ? "#FF6B6B"
      : authStatus === "AUTHENTICATED" ? "#4A9EFF"
      : "rgba(255,255,255,0.5)";

    return (
      <Shell title={config.title} status={config.status} id={config.id}>
        <div className="relative flex min-h-[82vh] items-center justify-center px-6 overflow-hidden">
          <AuroraBackground variant="blue" intensity={0.9} />

          {/* ambient particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.slice(0, 10).map((p, i) => <Particle key={i} {...p} />)}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-lg"
          >
            <motion.p
              className="sans-label mb-4 text-center"
              initial={{ opacity: 0, filter: "blur(6px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ delay: 0.1 }}
            >
              Authenticate
            </motion.p>

            <motion.h1
              className="mb-10 text-center font-sans font-extrabold leading-[1.05] tracking-tight text-white"
              style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
            >
              {config.title}
            </motion.h1>

            <motion.div
              className="glass rounded-2xl p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.6 }}
            >
              <form onSubmit={handleAuth} className="space-y-7">
                {isTwoFields ? (
                  config.authFields.map((f, i) => (
                    <div key={f.fieldName}>
                      <label className="sans-label mb-2 block">{f.fieldLabel}</label>
                      <input
                        value={credentials[f.fieldName] ?? ""}
                        onChange={(e) => setCredentials((p) => ({ ...p, [f.fieldName]: e.target.value }))}
                        className="field-glass text-base"
                        autoFocus={i === 0}
                        required
                      />
                    </div>
                  ))
                ) : (
                  <div>
                    <label className="sans-label mb-2 block">Access code</label>
                    <input
                      value={credentials.access_code ?? ""}
                      onChange={(e) => { setCredentials({ access_code: e.target.value.toUpperCase() }); if (authStatus === "DENIED") setAuthStatus("READY"); }}
                      placeholder="······"
                      maxLength={6}
                      autoFocus
                      required
                      className="field-glass text-3xl tracking-[0.5em] text-center font-sans font-medium"
                    />
                  </div>
                )}

                <div className="pt-1">
                  <motion.p
                    className="mb-3 min-h-[1.1em] font-sans font-medium text-[0.7rem] uppercase tracking-[0.18em]"
                    style={{ color: statusColor }}
                    animate={{ opacity: authStatus === "VERIFYING" ? [1, 0.4, 1] : 1 }}
                    transition={{ repeat: authStatus === "VERIFYING" ? Infinity : 0, duration: 0.8 }}
                    aria-live="polite"
                  >
                    {statusText}
                  </motion.p>
                  <button
                    type="submit"
                    disabled={authStatus === "VERIFYING"}
                    className="btn btn-primary w-full"
                  >
                    {authStatus === "VERIFYING" ? "Checking…" : <>Continue <span aria-hidden="true">⟶</span></>}
                  </button>
                </div>
              </form>
            </motion.div>

            <motion.p
              className="mt-8 max-w-sm mx-auto text-center text-sm leading-relaxed text-white/55"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Your access code lets you vote once. Your selections are recorded separately from your identity. Need help? Contact the election admin.
            </motion.p>
          </motion.div>
        </div>
      </Shell>
    );
  }

  /* ── ballot ─────────────────────────────────────────────── */
  const contests = ballotData!.ballot;
  const total = contests.length;
  const requiredMissing = contests.filter(
    (c) => config.allowAbstain === false && c.candidates.length > 0 && (selections[c.positionId]?.length ?? 0) === 0
  );

  if (step === "review") {
    const reviewTotal = contests.reduce((s, c) => s + (selections[c.positionId]?.length ?? 0), 0);
    const isBlank = reviewTotal === 0;
    const blockSubmit = requiredMissing.length > 0;
    return (
      <Shell title={config.title} status={config.status} id={config.id}>
        <div className="relative mx-auto max-w-3xl px-6 py-16 overflow-hidden">
          <AuroraBackground variant="blue" intensity={0.6} />
          <div className="relative z-10">
            <button
              onClick={() => setStep("ballot")}
              className="link-underline mb-10 font-sans font-medium text-[0.65rem] uppercase tracking-[0.22em] text-white/35 hover:text-white transition-colors"
            >
              ⟵ Back to ballot
            </button>
            <p className="sans-label mb-4">Review</p>
            <h1 className="mb-14 font-sans font-extrabold leading-[1.05] tracking-tight text-white"
              style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)" }}>
              Confirm your ballot.
            </h1>

            <div className="glass rounded-2xl overflow-hidden">
              {contests.map((c, i) => {
                const chosen = (selections[c.positionId] ?? [])
                  .map((id) => c.candidates.find((x) => x.id === id)?.name)
                  .filter(Boolean) as string[];
                return (
                  <motion.div
                    key={c.positionId}
                    className="grid grid-cols-[3rem_1fr] gap-4 py-6 px-6 border-b border-white/[0.05] last:border-b-0 md:grid-cols-[4rem_1fr]"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                  >
                    <span className="font-sans font-medium text-[0.7rem] text-white/45">{pad2(i)}</span>
                    <div>
                      <p className="sans-label mb-2">{c.title}</p>
                      {chosen.length ? (
                        chosen.map((n) => (
                          <p key={n} className="font-sans font-semibold text-[1.3rem] leading-snug text-white">{n}</p>
                        ))
                      ) : config.allowAbstain === false && c.candidates.length > 0 ? (
                        <p className="font-sans italic text-[1.2rem] text-[#FF9F6C]">— selection required</p>
                      ) : c.candidates.length === 0 ? (
                        <p className="font-sans italic text-[1.2rem] text-white/55">— no candidates</p>
                      ) : (
                        <p className="font-sans italic text-[1.2rem] text-white/55">— abstained</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {(isBlank || blockSubmit) && (
              <motion.div
                className="mt-6 rounded-xl px-5 py-4 border-l-2"
                style={{ borderColor: blockSubmit ? "#FF4D4D" : "#4A9EFF", background: blockSubmit ? "rgba(255,77,77,0.05)" : "rgba(74,158,255,0.05)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <p className="font-sans text-lg text-white">
                  {blockSubmit ? "Every available contest needs a selection." : "You are abstaining from this election."}
                </p>
                <p className="mt-1 text-[0.95rem] leading-relaxed text-white/40">
                  {blockSubmit
                    ? `${requiredMissing.map((pos) => pos.title).join(", ")} ${requiredMissing.length === 1 ? "is" : "are"} still missing.`
                    : "Submitting now records a blank ballot — no candidate will receive your vote."}
                </p>
              </motion.div>
            )}

            {authMsg && (
              <p className="mt-6 font-sans font-medium text-[0.7rem] uppercase tracking-[0.2em] text-red-400">{authMsg}</p>
            )}

            <div className="mt-16 flex flex-col items-center">
              <HoldToConfirm
                onConfirm={handleSubmit}
                busy={submitting}
                disabled={blockSubmit}
                hint={blockSubmit ? "Complete every available contest to submit" : "Press and hold to submit your vote"}
              />
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // ballot carousel
  const contest = contests[current];
  const selectedHere = selections[contest.positionId] ?? [];
  const currentRequiredMissing = config.allowAbstain === false && contest.candidates.length > 0 && selectedHere.length === 0;
  const abstainAll = () => {
    const cleared: Record<string, string[]> = {};
    contests.forEach((c) => { cleared[c.positionId] = []; });
    setSelections(cleared);
    setStep("review");
  };

  return (
    <Shell title={config.title} status={config.status} id={config.id}>
      {/* ambient aurora behind everything */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <AuroraBackground variant="blue" intensity={0.8} />
        {/* floating particles */}
        {particles.map((p, i) => <Particle key={i} {...p} />)}
      </div>

      {/* progress rail */}
      <div className="sticky top-12 z-20 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl px-6">
        <div className="mx-auto flex max-w-[1100px] items-center gap-5 py-3">
          <span className="shrink-0 font-sans font-medium text-[0.7rem] tracking-[0.2em] text-white">
            {pad2(current)} <span className="text-white/25">/ {String(total).padStart(2, "0")}</span>
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
            {contests.map((c, i) => {
              const has = (selections[c.positionId] ?? []).length > 0;
              const isCurrent = i === current;
              return (
                <button
                  key={c.positionId}
                  onClick={() => setCurrent(i)}
                  title={c.title}
                  className="group flex h-6 shrink-0 items-center"
                >
                  <motion.span
                    className="h-1.5 w-6 rounded-full transition-colors"
                    animate={{
                      background: isCurrent ? "#89AACC" : has ? "#4E85BF" : "rgba(255,255,255,0.12)",
                      scaleX: isCurrent ? 1.3 : 1,
                    }}
                    transition={{ duration: 0.25 }}
                  />
                </button>
              );
            })}
          </div>
          <span className="hidden shrink-0 font-sans font-medium text-[0.65rem] uppercase tracking-[0.2em] text-white/55 md:inline">
            {selectedHere.length}/{contest.maxVotes} selected
          </span>
        </div>
      </div>

      {/* viewport carousel */}
      <div className="relative z-10 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={contest.positionId}
            initial={{ x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -48, opacity: 0 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-[1200px] px-6 py-10 md:py-14"
          >
            {/* contest header */}
            <motion.div
              className="mb-10 flex items-end justify-between"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div>
                <p className="sans-label mb-3">Contest {pad2(current)}</p>
                <h2
                  className="font-sans font-extrabold leading-[1.05] tracking-tight text-white"
                  style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)" }}
                >
                  {contest.title}
                </h2>
                {contest.description && (
                  <p className="mt-3 max-w-xl text-sm text-white/40">{contest.description}</p>
                )}
              </div>
              <span className="hidden font-sans font-medium text-[0.7rem] tracking-[0.2em] text-white/55 md:block">
                {contest.maxVotes > 1 ? `CHOOSE UP TO ${contest.maxVotes}` : "CHOOSE ONE"}
              </span>
            </motion.div>

            {/* uniform candidate grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {contest.candidates.map((c, idx) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.07, ease: [0.22, 1, 0.36, 1] }}
                >
                  <CandidateCard
                    candidate={c}
                    selected={selectedHere.includes(c.id)}
                    onToggle={() => toggleCandidate(contest.positionId, c.id, contest.maxVotes)}
                  />
                </motion.div>
              ))}
              {contest.candidates.length === 0 && (
                <div className="sm:col-span-2 lg:col-span-3 py-10">
                  <p className="font-sans font-medium text-[0.7rem] uppercase tracking-[0.2em] text-white/55">No candidates listed.</p>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* nav */}
      <div className="sticky bottom-0 z-20 border-t border-white/[0.05] bg-black/80 backdrop-blur-xl px-6">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between py-4">
          <button
            disabled={current === 0}
            onClick={() => setCurrent((i) => Math.max(0, i - 1))}
            className="font-sans font-medium text-[0.68rem] uppercase tracking-[0.2em] text-white/55 transition-colors hover:text-white disabled:opacity-20"
          >
            ⟵ Prev
          </button>
          {config.allowAbstain ? (
            <button
              onClick={abstainAll}
              className="font-sans font-medium text-[0.62rem] uppercase tracking-[0.18em] text-white/55 transition-colors hover:text-white"
            >
              Abstain from election
            </button>
          ) : (
            <span className="font-sans font-medium text-[0.62rem] uppercase tracking-[0.18em] text-white/55">
              {contest.candidates.length === 0 ? "No candidates in this contest" : selectedHere.length ? "Selection recorded" : "Selection required"}
            </span>
          )}
          {current < total - 1 ? (
            <UnderlineSubmit type="button" onClick={() => setCurrent((i) => i + 1)} disabled={currentRequiredMissing}>
              Next ⟶
            </UnderlineSubmit>
          ) : (
            <UnderlineSubmit type="button" onClick={() => setStep("review")} disabled={currentRequiredMissing}>
              Review ⟶
            </UnderlineSubmit>
          )}
        </div>
      </div>
    </Shell>
  );
}

/* ── pieces ───────────────────────────────────────────────── */
function Shell({
  children, title, status, id,
}: { children: React.ReactNode; title: string; status?: string; id?: string }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar name={title} status={status} />
      <main className="flex-1">{children}</main>
      <Footer id={id} />
    </div>
  );
}

function CandidateCard({
  candidate, selected, onToggle,
}: { candidate: Candidate; selected: boolean; onToggle: () => void }) {
  const [hover, setHover] = useState(false);
  const initials = candidate.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  // Pointer-driven spotlight + subtle 3D tilt. Raw motion values are smoothed
  // through springs so the card settles rather than snapping.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotX = useSpring(useTransform(py, [0, 1], [6, -6]), { stiffness: 150, damping: 18 });
  const rotY = useSpring(useTransform(px, [0, 1], [-6, 6]), { stiffness: 150, damping: 18 });
  const spotlight = useTransform(
    () => `radial-gradient(420px circle at ${px.get() * 100}% ${py.get() * 100}%, rgba(74,158,255,0.18), transparent 45%)`
  );

  const onMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => { setHover(false); px.set(0.5); py.set(0.5); };

  return (
    <motion.button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ minHeight: 300, rotateX: rotX, rotateY: rotY, transformPerspective: 900 }}
      animate={{ scale: hover ? 1.025 : 1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className={`group relative w-full rounded-[1.4rem] overflow-hidden text-left transition-[box-shadow,border-color] duration-300 ${
        selected
          ? "border border-[#4A9EFF] shadow-[0_0_0_1px_#4A9EFF,0_0_40px_rgba(74,158,255,0.4),0_0_90px_rgba(74,158,255,0.18)]"
          : "border border-white/[0.07] hover:border-white/[0.16] shadow-[0_18px_50px_-20px_rgba(0,0,0,0.7)]"
      }`}
    >
      {/* photo backdrop */}
      <div className="absolute inset-0">
        {candidate.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.photoUrl}
            alt={candidate.name}
            className="h-full w-full object-cover transition-transform duration-700 ease-out"
            style={{
              filter: selected ? "contrast(1.05) brightness(0.78)" : "grayscale(0.5) contrast(1.05) brightness(0.6)",
              transform: hover ? "scale(1.08)" : "scale(1.02)",
            }}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-white/[0.05] to-white/[0.01] flex items-center justify-center">
            <span className="font-sans font-bold text-5xl text-white/12">{initials}</span>
          </div>
        )}
        <div className="absolute inset-0 halftone opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/35 to-black/10" />
        {selected && (
          <div className="absolute inset-0 bg-gradient-to-t from-[#4A9EFF]/30 via-transparent to-transparent" />
        )}
      </div>

      {/* cursor spotlight */}
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: spotlight }}
      />

      {/* content */}
      <div className="relative z-10 flex flex-col justify-end p-6" style={{ minHeight: 300 }}>
        <p className="font-sans font-bold text-[1.55rem] leading-[1.1] tracking-tight text-white">
          {candidate.name}
        </p>
        <p className="mt-2 font-sans text-[0.95rem] leading-snug text-white/55">
          {candidate.description || "Independent candidate"}
        </p>

        {/* selection affordance */}
        <div className="mt-4 flex items-center gap-2">
          <motion.span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 font-sans text-[0.72rem] font-semibold"
            animate={{
              background: selected ? "rgba(74,158,255,0.18)" : "rgba(255,255,255,0.06)",
              color: selected ? "#9EC9FF" : "rgba(255,255,255,0.55)",
            }}
            transition={{ duration: 0.25 }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: selected ? "#4A9EFF" : "rgba(255,255,255,0.35)" }}
            />
            {selected ? "Selected" : "Tap to select"}
          </motion.span>
        </div>
      </div>

      {/* selection check badge */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #4A9EFF, #1A5FBF)", boxShadow: "0 6px 20px rgba(74,158,255,0.5)" }}
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 90 }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
          >
            <svg width="14" height="14" viewBox="0 0 13 13" fill="none">
              <motion.path
                d="M2.5 6.5l3 3 5-5" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 0.05 }}
              />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function UnderlineSubmit({
  children, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const [hover, setHover] = useState(false);
  return (
    <button
      {...props}
      type={props.type ?? "submit"}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`relative font-sans font-medium text-[0.7rem] uppercase tracking-[0.22em] text-white disabled:opacity-40 ${props.className ?? ""}`}
    >
      {children}
      <motion.span
        className="absolute -bottom-1 left-0 h-px w-full bg-[#4A9EFF]"
        initial={false}
        animate={{ scaleX: hover ? 1 : 0 }}
        style={{ originX: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      />
    </button>
  );
}
