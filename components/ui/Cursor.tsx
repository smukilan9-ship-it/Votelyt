"use client";
import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const [clicking, setClicking] = useState(false);
  const [label, setLabel] = useState<string | null>(null);

  const x = useMotionValue(-200);
  const y = useMotionValue(-200);

  // ring trails behind with a spring
  const ringX = useSpring(x, { stiffness: 200, damping: 24, mass: 0.6 });
  const ringY = useSpring(y, { stiffness: 200, damping: 24, mass: 0.6 });

  // dot is snappier
  const dotX = useSpring(x, { stiffness: 500, damping: 30, mass: 0.3 });
  const dotY = useSpring(y, { stiffness: 500, damping: 30, mass: 0.3 });

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const enableTimer = window.setTimeout(() => setEnabled(true), 0);
    document.body.classList.add("has-cursor");

    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);

      const el = e.target as HTMLElement;
      const interactive = el.closest("a,button,[role='button'],input,select,textarea,label,[data-cursor-label]");
      setActive(!!interactive);
      const cursorLabel = (interactive as HTMLElement | null)?.getAttribute("data-cursor-label");
      setLabel(cursorLabel ?? null);
    };

    const onDown = () => setClicking(true);
    const onUp = () => setClicking(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);

    return () => {
      window.clearTimeout(enableTimer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("has-cursor");
    };
  }, [x, y]);

  if (!enabled) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] hidden md:block">
      {/* outer glow halo — very soft, large */}
      <motion.div
        style={{ x: ringX, y: ringY }}
        className="absolute"
        animate={{ opacity: active ? 0.7 : 0.25 }}
        transition={{ duration: 0.35 }}
      >
        <motion.div
          animate={{
            scale: active ? 2.8 : clicking ? 0.7 : 1,
            opacity: active ? 0.6 : 0.15,
          }}
          transition={{ type: "spring", stiffness: 250, damping: 22 }}
          className="absolute rounded-full"
          style={{
            width: 48,
            height: 48,
            top: -24,
            left: -24,
            background: active
              ? "radial-gradient(circle, rgba(74,158,255,0.35) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)",
            filter: "blur(8px)",
          }}
        />
      </motion.div>

      {/* ring — clean, precise */}
      <motion.div
        style={{ x: ringX, y: ringY }}
        className="absolute"
      >
        <motion.div
          animate={{
            scale: active ? 1.7 : clicking ? 0.6 : 1,
            borderColor: active ? "rgba(74,158,255,0.8)" : "rgba(255,255,255,0.45)",
            borderWidth: active ? 1.5 : 1,
          }}
          transition={{ type: "spring", stiffness: 280, damping: 20 }}
          className="absolute rounded-full border"
          style={{ width: 28, height: 28, top: -14, left: -14 }}
        />
        {/* cursor label */}
        {label && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute left-5 top-0 whitespace-nowrap font-mono text-[0.58rem] tracking-[0.14em] uppercase"
            style={{ color: "rgba(74,158,255,0.9)" }}
          >
            {label}
          </motion.span>
        )}
      </motion.div>

      {/* dot — snappy, centered */}
      <motion.div
        style={{ x: dotX, y: dotY }}
        className="absolute"
      >
        <motion.div
          animate={{
            scale: active ? 0.4 : clicking ? 2.5 : 1,
            background: active ? "#4A9EFF" : "#ffffff",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 24 }}
          className="rounded-full"
          style={{ width: 5, height: 5, top: -2.5, left: -2.5, position: "absolute" }}
        />
      </motion.div>
    </div>
  );
}
