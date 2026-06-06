"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Users, Layers } from "lucide-react";
import { TEMPLATES } from "@/lib/templates";
import { InteractiveHeading } from "@/components/ui/InteractiveHeading";

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-28">
      <motion.div initial={{ opacity: 0, filter: "blur(6px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: 0.6 }}>
        <Link href="/admin/elections/new" className="mb-6 inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-white/35 hover:text-white transition-colors">
          <ArrowLeft size={13} /> Back
        </Link>
        <InteractiveHeading as="h1" className="mb-5 font-sans font-extrabold tracking-tight leading-[1.02] text-white" style={{ fontSize: "clamp(2.6rem, 7vw, 5rem)" }}>
          Templates.
        </InteractiveHeading>
        <p className="mb-16 max-w-xl text-[1.05rem] text-white/45">
          Professionally designed starting points. Load one, then change anything — they&apos;re not locked.
        </p>
      </motion.div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link
              href={`/admin/elections/new/custom?template=${t.id}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-3xl glass p-7 card-lift"
            >
              {/* accent glow on hover */}
              <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" style={{ background: `${t.accent}22` }} />

              <div className="mb-6 flex items-center justify-between">
                <span className="rounded-full px-3 py-1 font-mono text-[0.55rem] uppercase tracking-[0.16em]" style={{ color: t.accent, background: `${t.accent}14`, border: `1px solid ${t.accent}33` }}>
                  {t.category}
                </span>
                {t.fixed && (
                  <span className="inline-flex items-center gap-1 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-white/35">
                    <Check size={10} /> fixed
                  </span>
                )}
              </div>

              <h2 className="mb-2 font-sans font-bold text-[1.35rem] leading-tight tracking-tight text-white">{t.name}</h2>
              <p className="mb-7 flex-1 text-[0.9rem] leading-relaxed text-white/45">{t.tagline}</p>

              <div className="mb-6 flex items-center gap-5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-white/35">
                <span className="inline-flex items-center gap-1.5"><Layers size={12} style={{ color: t.accent }} /> {t.config.positions.length} positions</span>
                <span className="inline-flex items-center gap-1.5"><Users size={12} style={{ color: t.accent }} /> {t.config.voterFields.length} fields</span>
              </div>

              <span className="inline-flex items-center gap-2 font-sans font-semibold text-[0.85rem] transition-all group-hover:gap-3" style={{ color: t.accent }}>
                {t.fixed ? "Quick create" : "Use & edit"} <ArrowRight size={15} />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
