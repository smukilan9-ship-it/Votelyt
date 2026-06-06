"use client";
import { motion } from "framer-motion";
import { AuroraBackground } from "@/components/ui/AuroraBackground";

interface ErrorStateProps {
  code?: string;
  title: string;
  message: string;
  actions: React.ReactNode;
}

/**
 * Calm, cinematic error layout shared by error.tsx / not-found.tsx.
 * No fake status codes or "NODE OK" theatre — just a clear heading,
 * a helpful explanation, and real actions.
 */
export function ErrorState({ code, title, message, actions }: ErrorStateProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <AuroraBackground variant="blue" intensity={0.6} />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-lg text-center"
      >
        {code && (
          <motion.p
            className="font-sans font-extrabold leading-none accent-gradient-text"
            style={{ fontSize: "clamp(4rem, 18vw, 9rem)", letterSpacing: "-0.04em" }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            {code}
          </motion.p>
        )}
        <h1
          className="mt-2 font-sans font-extrabold tracking-tight text-white"
          style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)" }}
        >
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[1rem] leading-relaxed text-white/60">
          {message}
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          {actions}
        </div>
      </motion.div>
    </main>
  );
}
