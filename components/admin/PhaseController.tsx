"use client";
import { useRef, useState } from "react";

const PHASES = [
  { key: "DRAFT", status: "DRAFT", action: "DRAFT", verb: "open polls" },
  { key: "OPEN", status: "ACTIVE", action: "OPEN", verb: "close polls" },
  { key: "CLOSE", status: "ENDED", action: "CLOSE", verb: "" },
] as const;

export function PhaseController({
  status,
  busy,
  onAdvance,
}: {
  status: string;
  busy: boolean;
  onAdvance: (nextStatus: string) => void;
}) {
  const current = PHASES.findIndex((p) => p.status === status);
  const next = current + 1 < PHASES.length ? current + 1 : -1;
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    if (next < 0 || busy) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      setHolding(false);
      onAdvance(PHASES[next].status);
    }, 1100);
  };
  const cancel = () => {
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
  };

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <div className="flex gap-1 rounded-xl glass p-1">
        {PHASES.map((p, i) => {
          const isCurrent = i === current;
          const isNext = i === next;
          const done = i < current;
          return (
            <div
              key={p.key}
              onPointerDown={isNext ? start : undefined}
              onPointerUp={isNext ? cancel : undefined}
              onPointerLeave={isNext ? cancel : undefined}
              className="relative select-none overflow-hidden rounded-lg px-4 py-2 transition-all duration-200"
              style={{
                cursor: isNext && !busy ? "pointer" : "default",
                background: isCurrent
                  ? "rgba(74,158,255,0.15)"
                  : isNext
                  ? "rgba(255,255,255,0.04)"
                  : "transparent",
              }}
            >
              {/* hold fill */}
              {isNext && (
                <span
                  className="absolute inset-0 rounded-lg"
                  style={{
                    background: "linear-gradient(135deg, #4A9EFF, #2B7FE0)",
                    transformOrigin: "left",
                    transform: holding ? "scaleX(1)" : "scaleX(0)",
                    transition: holding ? "transform 1.1s linear" : "transform 0.2s ease",
                  }}
                />
              )}
              <span
                className="relative font-sans text-[0.74rem] font-semibold uppercase tracking-[0.1em]"
                style={{
                  color: holding && isNext ? "#fff"
                    : isCurrent ? "#4A9EFF"
                    : done ? "rgba(255,255,255,0.6)"
                    : "rgba(255,255,255,0.25)",
                }}
              >
                {isNext ? p.action : p.key}
              </span>
            </div>
          );
        })}
      </div>
      <span className="font-sans text-[0.74rem] font-medium text-white/40">
        {next < 0
          ? "Close phase - terminal"
          : busy
          ? "Updating…"
          : `Hold ${PHASES[next].action} to ${PHASES[current]?.verb ?? "advance"}`}
      </span>
    </div>
  );
}
