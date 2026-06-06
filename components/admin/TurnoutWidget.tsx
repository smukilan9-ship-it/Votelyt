"use client";
import { useEffect, useState } from "react";
import { Ticker } from "@/components/admin/Ticker";

interface Pt { t: number; v: number }
interface TurnoutData { total: number; voted: number; pending: number; percentage: number; series: Pt[] }

export function TurnoutWidget({ electionId }: { electionId: string }) {
  const [data, setData] = useState<TurnoutData | null>(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let controller: AbortController | null = null;

    const fetchTurnout = async () => {
      // Skip when a request is already running or the tab is backgrounded —
      // no point polling a chart nobody is looking at.
      if (inFlight || document.hidden) return;
      inFlight = true;
      controller = new AbortController();
      try {
        const res = await fetch(`/api/elections/${electionId}/turnout`, { signal: controller.signal });
        if (!cancelled && res.ok) setData(await res.json());
      } catch {
        /* aborted or network blip — next tick retries */
      } finally {
        inFlight = false;
      }
    };

    fetchTurnout();
    const id = setInterval(fetchTurnout, 10000);
    // Refresh immediately when the tab regains focus after being hidden.
    const onVisible = () => { if (!document.hidden) fetchTurnout(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [electionId]);

  if (!data) {
    return (
      <div className="glass rounded-2xl p-8">
        <div className="h-24 w-full animate-pulse bg-white/[0.03] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05]">
        <span className="mono-label text-white/50">Turnout</span>
        <span className="flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-white/25">
          <span className="h-1.5 w-1.5 rounded-full bg-[#4A9EFF] animate-pulse" />
          Live · 10s
        </span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-white/[0.05] border-b border-white/[0.05]">
        <Cell label="Cast" value={data.voted} />
        <Cell label="Pending" value={data.pending} />
        <Cell label="Turnout" value={data.percentage} suffix="%" accent />
      </div>

      <LineChart series={data.series} />
    </div>
  );
}

function Cell({ label, value, suffix = "", accent = false }: { label: string; value: number; suffix?: string; accent?: boolean }) {
  return (
    <div className="px-6 py-6">
      <p className="mb-3 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-white/30">{label}</p>
      <p className="font-mono text-3xl font-bold tracking-tight" style={{ color: accent ? "#4A9EFF" : "rgba(255,255,255,0.85)" }}>
        <Ticker value={value} suffix={suffix} />
      </p>
    </div>
  );
}

function LineChart({ series }: { series: Pt[] }) {
  const W = 600, H = 140, P = 8;
  if (!series || series.length < 2) {
    return (
      <div className="grid h-[160px] place-items-center">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-white/20">No ballots cast yet</span>
      </div>
    );
  }
  const x = (t: number) => P + t * (W - 2 * P);
  const y = (v: number) => H - P - v * (H - 2 * P);
  const d = series.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = series[series.length - 1];

  /* area fill path */
  const area = `${d} L${x(last.t).toFixed(1)},${H - P} L${x(series[0].t).toFixed(1)},${H - P} Z`;

  return (
    <div className="px-2 py-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4A9EFF" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#4A9EFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((g) => (
          <line key={g} x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#area-grad)" />
        <path d={d} fill="none" stroke="#4A9EFF" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <circle cx={x(last.t)} cy={y(last.v)} r="3" fill="#4A9EFF" />
        <circle cx={x(last.t)} cy={y(last.v)} r="6" fill="rgba(74,158,255,0.25)" />
      </svg>
      <div className="flex justify-between px-4 font-mono text-[0.55rem] uppercase tracking-[0.18em] text-white/20">
        <span>Open</span>
        <span>Time ⟶</span>
        <span>Now</span>
      </div>
    </div>
  );
}
