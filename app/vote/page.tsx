"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { BrandName, VotelytLogo } from "@/components/ui/Brand";
import { Footer } from "@/components/ui/Chrome";
import { AuroraBackground } from "@/components/ui/AuroraBackground";

export default function VoteIndexPage() {
  const [id, setId] = useState("");
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (id.trim()) router.push(`/vote/${id.trim()}`);
  };

  return (
    <div className="flex min-h-screen flex-col relative overflow-hidden">
      <AuroraBackground variant="blue" intensity={0.9} />

      <div className="relative z-10 flex justify-center px-6 pt-6">
        <div className="glass rounded-full flex items-center gap-3 px-5 py-2.5">
          <VotelytLogo size={22} />
          <BrandName className="font-sans font-semibold text-[1rem] text-white" />
        </div>
      </div>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md text-center"
        >
          <motion.p
            className="font-sans font-medium text-[0.7rem] uppercase tracking-[0.18em] text-white/35 mb-5"
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            Ballot Entry
          </motion.p>

          <div className="overflow-hidden mb-3">
            <motion.h1
              className="font-sans font-extrabold text-white tracking-tight leading-[1.02]"
              style={{ fontSize: "clamp(2.8rem, 8vw, 4.5rem)" }}
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              Cast your
            </motion.h1>
          </div>
          <div className="overflow-hidden mb-10">
            <motion.h1
              className="font-sans font-extrabold tracking-tight leading-[1.02] accent-gradient-text"
              style={{ fontSize: "clamp(2.8rem, 8vw, 4.5rem)" }}
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              transition={{ delay: 0.25, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              vote.
            </motion.h1>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <form onSubmit={submit} className="glass rounded-2xl p-8 space-y-6">
              <div>
                <label className="font-sans font-medium text-[0.65rem] uppercase tracking-[0.16em] text-white/40 mb-2 block text-left">
                  Election ID
                </label>
                <input
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="e.g. ABCD1234"
                  autoFocus
                  className="field-glass text-[1.05rem] tracking-[0.12em] text-center"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="font-sans font-medium text-[0.65rem] uppercase tracking-[0.16em] text-white/30">
                  {id.trim() ? "Ready" : "Awaiting ID"}
                </span>
                <motion.button type="submit"
                  className="text-[0.88rem] font-semibold text-white tracking-wide"
                  whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                  Continue ⟶
                </motion.button>
              </div>
            </form>

            <p className="mt-6 text-[0.9rem] leading-relaxed text-white/35">
              Your election ID was issued by your administrator.{" "}
              <Link href="/admin" className="link-underline text-white/60 hover:text-white transition-colors">Admin →</Link>
            </p>
          </motion.div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
