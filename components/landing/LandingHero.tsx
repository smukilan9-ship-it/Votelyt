"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BrandName, VotelytLogo } from "@/components/ui/Brand";
import { HlsVideo } from "@/components/ui/HlsVideo";
import { ArrowDown, Shield, BarChart3, Users, Lock } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const HLS_SRC = "https://stream.mux.com/Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g.m3u8";
const ROLES = ["House Captain", "Sports Captain", "Class President", "Student Leader"];

const FEATURES = [
  {
    icon: Shield,
    title: "Private Ballots",
    body: "Votes are recorded separately from voter identity, so individual selections aren't shown next to who cast them.",
  },
  {
    icon: BarChart3,
    title: "Live Turnout",
    body: "Watch participation climb in real time. Admins see how many have voted — never how any individual voted.",
  },
  {
    icon: Lock,
    title: "Sealed Results",
    body: "Results stay hidden until the admin closes the election. No partial tallies are shown before polls close.",
  },
  {
    icon: Users,
    title: "Any Election",
    body: "Student councils, house captains, faculty boards. Configure positions, voter lists, and sign-in — all in minutes.",
  },
];

const STATS = [
  { value: "Private", label: "Ballots" },
  { value: "Single-use", label: "Access codes" },
  { value: "Live", label: "Turnout" },
  { value: "Sealed", label: "Until close" },
];

export function LandingHero() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [roleIdx, setRoleIdx] = useState(0);
  const [phase, setPhase] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200);
    const t2 = setTimeout(() => setPhase(2), 400);
    const t3 = setTimeout(() => setPhase(3), 650);
    const ri = setInterval(() => setRoleIdx((i) => (i + 1) % ROLES.length), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearInterval(ri); };
  }, []);

  // GSAP scroll animations for feature cards
  useEffect(() => {
    if (!featuresRef.current) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".feat-card").forEach((card, i) => {
        gsap.fromTo(card,
          { opacity: 0, y: 60 },
          {
            opacity: 1, y: 0,
            duration: 0.8,
            ease: "power3.out",
            delay: i * 0.12,
            scrollTrigger: {
              trigger: card,
              start: "top 85%",
              toggleActions: "play none none none",
            },
          }
        );
      });

      // stat counters
      gsap.utils.toArray<HTMLElement>(".stat-item").forEach((el, i) => {
        gsap.fromTo(el,
          { opacity: 0, y: 30 },
          {
            opacity: 1, y: 0,
            duration: 0.7,
            ease: "power3.out",
            delay: i * 0.1,
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              toggleActions: "play none none none",
            },
          }
        );
      });

      // section headings
      gsap.utils.toArray<HTMLElement>(".scroll-reveal").forEach((el) => {
        gsap.fromTo(el,
          { opacity: 0, y: 40 },
          {
            opacity: 1, y: 0,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 82%",
              toggleActions: "play none none none",
            },
          }
        );
      });
    }, featuresRef);
    return () => ctx.revert();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (id.trim()) router.push(`/vote/${id.trim()}`);
  };

  return (
    <div ref={containerRef}>
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 1 — HERO (full-viewport)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative min-h-screen overflow-hidden flex flex-col">

        {/* HLS video background */}
        <div className="absolute inset-0 z-0">
          <HlsVideo src={HLS_SRC} className="h-full w-full object-cover" style={{ opacity: 0.4 }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
        </div>

        {/* Frosted navbar */}
        <nav className="relative z-30 flex justify-center pt-6 px-6">
          <motion.div
            className="glass rounded-full flex items-center gap-5 px-5 py-3"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="h-9 w-9 rounded-full glass-strong flex items-center justify-center shrink-0">
              <VotelytLogo size={22} />
            </div>
            <BrandName className="font-sans text-[1.1rem] text-white font-semibold" />
            <div className="h-4 w-px bg-white/10" />
            {[{ label: "Vote", href: "/vote" }, { label: "Admin", href: "/admin" }].map((l) => (
              <Link key={l.href} href={l.href}
                className="text-sm font-medium text-white/50 hover:text-white transition-colors duration-200 tracking-wide">
                {l.label}
              </Link>
            ))}
          </motion.div>
        </nav>

        {/* Hero content — centred */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center flex-1 px-6 pb-20 md:px-16 max-w-5xl mx-auto w-full">

          {/* Eyebrow */}
          <motion.p
            className="label mb-8"
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={phase >= 1 ? { opacity: 1, filter: "blur(0px)" } : {}}
            transition={{ duration: 0.7 }}
          >
            ELECTION &apos;26
          </motion.p>

          {/* Main headline — staggered character reveal */}
          <div className="overflow-hidden mb-3">
            <h1 className="font-sans font-extrabold leading-[1] tracking-tight text-white"
              style={{ fontSize: "clamp(3.5rem, 10vw, 9rem)" }}>
              {"Cast your".split("").map((char, i) => (
                <motion.span key={i}
                  initial={{ y: "100%", opacity: 0 }}
                  animate={phase >= 2 ? { y: "0%", opacity: 1 } : {}}
                  transition={{ duration: 0.65, delay: i * 0.025, ease: [0.22, 1, 0.36, 1] }}
                  style={{ display: char === " " ? "inline" : "inline-block" }}>
                  {char}
                </motion.span>
              ))}
            </h1>
          </div>
          <div className="overflow-hidden mb-10">
            <h1 className="font-sans font-extrabold leading-[1] tracking-tight"
              style={{ fontSize: "clamp(3.5rem, 10vw, 9rem)" }}>
              {"vote.".split("").map((char, i) => (
                <motion.span key={i}
                  initial={{ y: "100%", opacity: 0 }}
                  animate={phase >= 2 ? { y: "0%", opacity: 1 } : {}}
                  transition={{ duration: 0.65, delay: 0.28 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  className="accent-gradient-text"
                  style={{ display: "inline-block" }}>
                  {char}
                </motion.span>
              ))}
            </h1>
          </div>

          {/* Cycling role */}
          <div className="h-7 overflow-hidden mb-12">
            <AnimatePresence mode="wait">
              <motion.p key={ROLES[roleIdx]}
                className="text-[0.9rem] font-medium tracking-[0.2em] uppercase text-white/40"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
                {ROLES[roleIdx]}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Login card — centred */}
          <motion.div
            className="glass rounded-2xl p-8 w-full max-w-md"
            initial={{ opacity: 0, y: 32 }}
            animate={phase >= 3 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="label mb-5 text-center">Enter the ballot</p>
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="label mb-2 block text-left">Election ID</label>
                <input value={id} onChange={(e) => setId(e.target.value)}
                  placeholder="e.g. ABCD1234" autoComplete="off"
                  className="field-glass text-[1rem] text-center tracking-widest" />
              </div>
              <button type="submit" className="btn btn-primary w-full text-[0.95rem]">
                Continue
                <span aria-hidden="true">⟶</span>
              </button>
            </form>
            <p className="mt-6 text-sm leading-relaxed text-white/40 text-center">
              ID issued by your administrator.{" "}
              <Link href="/admin" className="link-underline text-white/70 hover:text-white transition-colors">Admin →</Link>
            </p>
          </motion.div>
        </div>

        {/* Scroll cue */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10"
          initial={{ opacity: 0 }}
          animate={phase >= 3 ? { opacity: 1 } : {}}
          transition={{ delay: 1.2 }}
        >
          <span className="label text-[0.56rem]">SCROLL</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}>
            <ArrowDown size={14} className="text-white/30" />
          </motion.div>
        </motion.div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 2 — WHAT IS VOTELYT (scroll reveal)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section ref={featuresRef} className="relative bg-[#000] py-20 px-5 md:py-32 md:px-16 lg:px-24 overflow-hidden">
        {/* subtle dot grid bg */}
        <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />

        <div className="max-w-7xl mx-auto">
          {/* Section label */}
          <div className="scroll-reveal mb-6">
            <span className="label">What is Votelyt</span>
          </div>

          {/* Large section heading */}
          <h2 className="scroll-reveal font-sans font-bold text-white leading-[1.05] tracking-tight mb-8"
            style={{ fontSize: "clamp(2.4rem, 5.5vw, 5.5rem)" }}>
            Democratic infrastructure
            <br />
            <span className="accent-gradient-text">built for everyone.</span>
          </h2>

          <p className="scroll-reveal text-[1.05rem] md:text-[1.15rem] text-white/55 max-w-2xl leading-relaxed mb-12 md:mb-20">
            Votelyt is a modern voting platform for organisations. Whether you&apos;re running a student council election or a faculty vote, Votelyt handles everything — from voter sign-in to sealed results — with privacy built in at every step.
          </p>

          {/* Feature grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="feat-card group relative rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 md:p-8 transition-all duration-500 hover:border-[#4A9EFF]/30 hover:bg-white/[0.04]">
                  {/* hover glow */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: "radial-gradient(ellipse at top left, rgba(74,158,255,0.06) 0%, transparent 65%)" }} />
                  <div className="relative z-10">
                    <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
                      <Icon size={20} className="text-[#4A9EFF]" />
                    </div>
                    <h3 className="text-[1.2rem] font-semibold text-white mb-3 tracking-tight">{f.title}</h3>
                    <p className="text-[0.95rem] text-white/50 leading-relaxed">{f.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 3 — STATS BAR
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative border-y border-white/[0.06] py-16 px-5 md:py-20 md:px-16 lg:px-24 overflow-hidden">
        <div className="absolute inset-0 accent-gradient opacity-[0.03] pointer-events-none" />
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
          {STATS.map((s) => (
            <div key={s.label} className="stat-item text-center">
              <p className="font-bold accent-gradient-text mb-2 tracking-tight"
                style={{ fontSize: "clamp(1.7rem, 3.4vw, 2.8rem)", letterSpacing: "-0.02em" }}>
                {s.value}
              </p>
              <p className="label">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 4 — HOW IT WORKS
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 px-5 md:py-32 md:px-16 lg:px-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="scroll-reveal mb-6"><span className="label">How it works</span></div>
          <h2 className="scroll-reveal font-bold text-white leading-tight tracking-tight mb-12 md:mb-20"
            style={{ fontSize: "clamp(2.4rem, 5vw, 5rem)" }}>
            Three steps to
            <br /><span className="accent-gradient-text">a fair result.</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.05] rounded-2xl overflow-hidden border border-white/[0.05]">
            {[
              { n: "01", title: "Configure", body: "Set up positions, import voter lists, choose authentication mode. Done in minutes." },
              { n: "02", title: "Vote", body: "Voters sign in once and cast a private ballot. Each access code can be used only once." },
              { n: "03", title: "Reveal", body: "Close the election to unseal results. A live podium with animated vote tallies." },
            ].map((step) => (
              <div key={step.n} className="feat-card bg-[#000] p-8 md:p-10 group hover:bg-white/[0.02] transition-colors duration-300">
                <p className="font-mono text-[0.7rem] tracking-[0.2em] text-[#4A9EFF] mb-6">{step.n}</p>
                <h3 className="text-[1.6rem] font-bold text-white mb-4 tracking-tight">{step.title}</h3>
                <p className="text-[0.95rem] text-white/50 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 5 — CTA
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 px-5 md:py-32 md:px-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#4A9EFF]/[0.03] to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center">
          <p className="scroll-reveal label mb-6 justify-center flex">Ready to start</p>
          <h2 className="scroll-reveal font-bold text-white leading-tight tracking-tight mb-8"
            style={{ fontSize: "clamp(2.8rem, 6vw, 5.5rem)" }}>
            Your election,
            <br /><span className="accent-gradient-text">your rules.</span>
          </h2>
          <p className="scroll-reveal text-[1.1rem] text-white/50 mb-12 max-w-xl mx-auto leading-relaxed">
            Create your first election in under two minutes. No setup fees, no complexity — just a clean, private vote.
          </p>
          <motion.div className="scroll-reveal flex items-center justify-center gap-4 flex-wrap">
            <Link href="/admin"
              className="inline-flex items-center gap-2 rounded-full bg-[#4A9EFF] px-8 py-4 text-[0.95rem] font-semibold text-black tracking-wide hover:bg-[#7DC4FF] transition-colors duration-200">
              Go to Admin Console ⟶
            </Link>
            <Link href="/vote"
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] px-8 py-4 text-[0.95rem] font-medium text-white/70 hover:border-white/30 hover:text-white transition-all duration-200">
              Cast a Vote
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer marquee */}
      <footer className="border-t border-white/[0.05] py-5 overflow-hidden">
        <div className="marquee-inner font-mono text-[0.58rem] tracking-[0.28em] uppercase text-white/30 whitespace-nowrap select-none">
          {"VOTELYT • SECURE ONLINE VOTING • PRIVATE BALLOTS • ".repeat(20)}
        </div>
        <div className="mt-4 px-8 md:px-16 flex items-center justify-between font-mono text-[0.6rem] tracking-[0.14em] text-white/40">
          <span>Votelyt</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="mt-4 px-8 md:px-16 text-center font-sans text-[1.15rem] md:text-[1.5rem] font-semibold tracking-tight text-white/60">
          Designed and developed by{" "}
          <Link href="https://github.com/smukilan9-ship-it" target="_blank" rel="noopener noreferrer" className="text-[#4A9EFF] hover:text-[#7DC4FF] transition-colors">
            Mukilan
          </Link>
        </div>
      </footer>
    </div>
  );
}
