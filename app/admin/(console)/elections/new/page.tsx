"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Wrench, LayoutTemplate, ArrowRight } from "lucide-react";
import { InteractiveHeading } from "@/components/ui/InteractiveHeading";

const cards = [
  {
    href: "/admin/elections/new/custom",
    icon: Wrench,
    kicker: "01",
    title: "Create Your Own",
    body: "A blank canvas. Define voter fields, positions, eligibility rules, candidate fields and settings exactly how you need them.",
    cta: "Start building",
  },
  {
    href: "/admin/elections/templates",
    icon: LayoutTemplate,
    kicker: "02",
    title: "Load a Template",
    body: "Start from a professionally designed structure — school, university, club, corporate board and more. Every template is fully editable.",
    cta: "Browse templates",
  },
];

export default function NewElectionEntry() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-24 md:py-28">
      <motion.div
        initial={{ opacity: 0, filter: "blur(6px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.6 }}
      >
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-white/35 mb-5">Console · create</p>
        <InteractiveHeading
          as="h1"
          className="mb-6 font-sans font-extrabold tracking-tight leading-[1.02] text-white"
          style={{ fontSize: "clamp(2.6rem, 7vw, 5rem)" }}
        >
          New election.
        </InteractiveHeading>
        <p className="mb-16 max-w-xl text-[1.05rem] text-white/45">
          Two ways to begin. Build from scratch, or load a polished template and make it yours.
        </p>
      </motion.div>

      <div className="grid gap-5 md:grid-cols-2">
        {cards.map((c, i) => (
          <motion.div
            key={c.href}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link
              href={c.href}
              className="group relative block h-full overflow-hidden rounded-3xl glass p-9 card-lift"
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#4A9EFF]/[0.07] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="mb-8 flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.08] text-[#4A9EFF] group-hover:border-[#4A9EFF]/40 transition-colors">
                  <c.icon size={24} />
                </div>
                <span className="font-mono text-[0.7rem] text-white/20">{c.kicker}</span>
              </div>
              <h2 className="mb-3 font-sans font-bold text-[1.6rem] tracking-tight text-white">{c.title}</h2>
              <p className="mb-10 text-[0.95rem] leading-relaxed text-white/45">{c.body}</p>
              <span className="inline-flex items-center gap-2 font-sans font-semibold text-[0.9rem] text-[#4A9EFF] group-hover:gap-3 transition-all">
                {c.cta} <ArrowRight size={16} />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
