"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const WORDS = ["Register", "Verify", "Ballot", "Democracy"];
const DURATION = 2700;

export function Preloader() {
  const [count, setCount] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let raf: number | undefined;
    let wi: ReturnType<typeof setInterval> | undefined;
    let doneTimer: ReturnType<typeof setTimeout> | undefined;

    const mountTimer = setTimeout(() => {
      setMounted(true);
      if (sessionStorage.getItem("votelyt_loaded")) { setDone(true); return; }

      const start = performance.now();
      const tick = (now: number) => {
        const pct = Math.min(Math.floor(((now - start) / DURATION) * 100), 100);
        setCount(pct);
        if (now - start < DURATION) raf = requestAnimationFrame(tick);
        else doneTimer = setTimeout(() => { setDone(true); sessionStorage.setItem("votelyt_loaded", "1"); }, 180);
      };
      raf = requestAnimationFrame(tick);

      wi = setInterval(() => setWordIdx((i) => (i + 1) % WORDS.length), 900);
    }, 0);

    return () => {
      clearTimeout(mountTimer);
      if (raf !== undefined) cancelAnimationFrame(raf);
      if (wi !== undefined) clearInterval(wi);
      if (doneTimer !== undefined) clearTimeout(doneTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[200] flex flex-col bg-black overflow-hidden"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Top-left label */}
          <div className="absolute top-7 left-7 font-mono text-[0.65rem] tracking-[0.28em] uppercase text-white/25">
Votelyt
          </div>

          {/* Center: cycling word */}
          <div className="flex flex-1 items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={WORDS[wordIdx]}
                className="font-sans font-extrabold text-white select-none tracking-tight"
                style={{ fontSize: "clamp(3rem, 12vw, 8rem)" }}
                initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -28, filter: "blur(4px)" }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              >
                {WORDS[wordIdx]}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Bottom-right: counter */}
          <div className="absolute bottom-10 right-7 font-mono font-medium text-white/80 tabular"
            style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", letterSpacing: "-0.02em" }}>
            {String(count).padStart(3, "0")}
          </div>

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.06]">
            <motion.div
              className="h-full bg-[#4A9EFF] origin-left"
              style={{ scaleX: count / 100 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
