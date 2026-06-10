"use client";
import Link from "next/link";
import { VotelytLogo } from "@/components/ui/Brand";

const phaseLabel: Record<string, string> = {
  DRAFT: "DRAFT",
  ACTIVE: "OPEN",
  ENDED: "CLOSE",
};

export function TopBar({ name, status, href = "/" }: { name: string; status?: string; href?: string }) {
  const phase = status ? phaseLabel[status] ?? status : null;
  const live = status === "ACTIVE";
  return (
    <header className="sticky top-0 z-40 px-6 pt-5 pb-2">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between">
        <div className="glass rounded-full flex items-center gap-3 px-4 py-2.5">
          <VotelytLogo size={22} />
          <Link href={href} className="font-sans font-semibold text-[1rem] text-white hover:opacity-75 transition-opacity">
            {name}
          </Link>
        </div>
        {phase && (
          <Link
            href="/admin"
            aria-label="Go to the admin console"
            title="Admin console"
            className="focus-ring group glass rounded-full px-4 py-2 flex items-center gap-2 font-sans text-[0.65rem] font-medium uppercase tracking-[0.18em] transition-all duration-200 hover:border-[#4A9EFF]/40 hover:bg-white/[0.06]"
          >
            {live && <span className="h-1.5 w-1.5 rounded-full bg-[#4A9EFF] animate-pulse" />}
            <span
              className="transition-colors"
              style={{ color: live ? "#4A9EFF" : "rgba(255,255,255,0.55)" }}
            >
              {phase}
            </span>
            <span className="text-white/30 transition-colors group-hover:text-white/70" aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </header>
  );
}

export function Footer({ id, status }: { id?: string; status?: string }) {
  const chunk = "VOTELYT • SECURE ONLINE VOTING • ";
  const text = chunk.repeat(20);
  return (
    <footer className="border-t border-white/[0.05] mt-auto">
      <div className="overflow-hidden py-4">
        <div className="marquee-inner font-sans text-[0.58rem] font-medium tracking-[0.28em] uppercase text-white/30 whitespace-nowrap select-none">
          {text}
        </div>
      </div>
      <div className="border-t border-white/[0.04] px-6 py-3">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between font-sans text-[0.6rem] font-medium uppercase tracking-[0.14em] text-white/60">
          <span>{id ? `Election ${id}` : "Votelyt"}</span>
          {status && (
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-[#4A9EFF]" />
              {status}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
