"use client";
import { useEffect, useRef } from "react";

/**
 * Cursor-reactive parallax background. A few soft blue blobs drift toward the
 * pointer at different depths, giving subtle depth/parallax without a constant
 * animation loop — the rAF loop parks itself once everything settles and wakes
 * on pointer movement. Transform-only (GPU), respects reduced-motion.
 */
const BLOBS = [
  { size: 620, depth: 28, color: "rgba(74,158,255,0.16)", base: { x: 18, y: 22 } },
  { size: 520, depth: 46, color: "rgba(42,127,224,0.14)", base: { x: 78, y: 30 } },
  { size: 460, depth: 64, color: "rgba(125,196,255,0.10)", base: { x: 60, y: 78 } },
  { size: 380, depth: 90, color: "rgba(26,95,191,0.12)", base: { x: 30, y: 70 } },
];

export function InteractiveBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const els = Array.from(root.querySelectorAll<HTMLDivElement>("[data-blob]"));
    // target & current pointer offset, normalised to -0.5..0.5
    let tx = 0, ty = 0, cx = 0, cy = 0;
    let raf = 0;
    let running = false;

    const tick = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      els.forEach((el, i) => {
        const d = BLOBS[i].depth;
        el.style.transform = `translate3d(${cx * d}px, ${cy * d}px, 0)`;
      });
      // keep going only while there's meaningful movement
      if (Math.abs(tx - cx) > 0.0005 || Math.abs(ty - cy) > 0.0005) {
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };
    const wake = () => { if (!running) { running = true; raf = requestAnimationFrame(tick); } };

    const onMove = (e: PointerEvent) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
      wake();
    };
    const onLeave = () => { tx = 0; ty = 0; wake(); };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onLeave, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#020408]">
      {BLOBS.map((b, i) => (
        <div
          key={i}
          data-blob
          className="absolute rounded-full"
          style={{
            width: b.size, height: b.size,
            left: `${b.base.x}%`, top: `${b.base.y}%`,
            marginLeft: -b.size / 2, marginTop: -b.size / 2,
            background: `radial-gradient(circle, ${b.color} 0%, transparent 70%)`,
            filter: "blur(40px)",
            willChange: "transform",
          }}
        />
      ))}
      {/* faint grain + vignette for depth */}
      <div className="absolute inset-0 opacity-[0.5] noise" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 50% 0%, transparent 40%, rgba(0,0,0,0.55) 100%)" }} />
    </div>
  );
}
