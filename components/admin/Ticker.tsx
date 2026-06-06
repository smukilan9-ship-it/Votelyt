"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Numeric ticker. Counts up to `value` via GSAP whenever it changes — used for
 * the console's large mono numerics (turnout, ballots cast, …).
 */
export function Ticker({
  value,
  decimals = 0,
  suffix = "",
  className = "",
  duration = 1.1,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obj = { n: prev.current };
    const tween = gsap.to(obj, {
      n: value,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        node.textContent = obj.n.toFixed(decimals) + suffix;
      },
    });
    prev.current = value;
    return () => {
      tween.kill();
    };
  }, [value, decimals, suffix, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
