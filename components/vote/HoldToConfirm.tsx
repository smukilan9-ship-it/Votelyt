"use client";
import { useRef, useState } from "react";
import { motion, useAnimationControls, useMotionValue, useTransform, animate } from "framer-motion";

const ACCENT = "#4A9EFF";

/**
 * Press-and-hold confirm. A hold draws an accent ring to completion before
 * firing `onConfirm`. Releasing early rewinds. Keyboard accessible via
 * Enter/Space. The inner disc fills and the whole control glows as the hold
 * progresses, then "pops" on completion — a tactile ballot-sealing gesture.
 */
export function HoldToConfirm({
  hint = "Press and hold",
  duration = 1.2,
  onConfirm,
  busy = false,
  disabled = false,
}: {
  hint?: string;
  duration?: number;
  onConfirm: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const ring = useAnimationControls();
  const [holding, setHolding] = useState(false);
  const [sealed, setSealed] = useState(false);
  const done = useRef(false);

  // Shared 0→1 progress drives the inner fill + glow so they stay in lockstep
  // with the ring instead of being separately timed.
  const progress = useMotionValue(0);
  const fillScale = useTransform(progress, [0, 1], [0.4, 1]);
  const fillOpacity = useTransform(progress, [0, 1], [0, 0.9]);
  const glow = useTransform(
    progress,
    [0, 1],
    ["0 0 0 1px rgba(255,255,255,0.14)", "0 0 0 1px rgba(74,158,255,0.6), 0 0 38px rgba(74,158,255,0.55), 0 0 80px rgba(74,158,255,0.25)"]
  );

  const start = () => {
    if (busy || disabled || done.current) return;
    setHolding(true);
    ring.start({ pathLength: 1, transition: { duration, ease: "linear" } });
    animate(progress, 1, { duration, ease: "linear" }).then(() => {
      if (!done.current && progress.get() >= 0.999) {
        done.current = true;
        setSealed(true);
        onConfirm();
      }
    });
  };

  const cancel = () => {
    if (done.current) return;
    setHolding(false);
    ring.stop();
    ring.start({ pathLength: 0, transition: { duration: 0.25, ease: "easeOut" } });
    animate(progress, 0, { duration: 0.25, ease: "easeOut" });
  };

  const R = 46;

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <motion.button
        type="button"
        disabled={busy || disabled}
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !e.repeat) start();
        }}
        onKeyUp={(e) => {
          if (e.key === "Enter" || e.key === " ") cancel();
        }}
        className="relative grid h-28 w-28 place-items-center rounded-full outline-none disabled:opacity-50"
        style={{ cursor: "pointer", boxShadow: glow }}
        animate={{ scale: sealed ? [1, 1.12, 1] : holding ? 1.06 : 1 }}
        transition={sealed ? { duration: 0.45, ease: [0.22, 1, 0.36, 1] } : { type: "spring", stiffness: 260, damping: 18 }}
      >
        {/* inner fill disc — grows with the hold */}
        <motion.span
          className="absolute inset-[10px] rounded-full"
          style={{
            scale: fillScale,
            opacity: fillOpacity,
            background: "radial-gradient(circle at 50% 35%, rgba(74,158,255,0.55), rgba(26,95,191,0.25) 70%, transparent)",
          }}
        />

        {/* progress ring */}
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
          <motion.circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={ACCENT}
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={ring}
          />
        </svg>

        <span
          className="relative z-10 font-sans text-[0.62rem] font-semibold uppercase tracking-[0.2em] transition-colors"
          style={{ color: sealed || holding ? "#fff" : "rgba(255,255,255,0.85)" }}
        >
          {busy || sealed ? "Submitting…" : holding ? "Hold…" : "Submit"}
        </span>
      </motion.button>
      <p className="font-sans text-[0.7rem] uppercase tracking-[0.18em] text-white/40">
        {busy || sealed ? "Recording your vote" : hint}
      </p>
    </div>
  );
}
