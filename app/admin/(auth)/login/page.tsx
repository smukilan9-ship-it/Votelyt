"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { BrandName, VotelytLogo } from "@/components/ui/Brand";
import { Footer } from "@/components/ui/Chrome";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"READY" | "VERIFYING" | "DENIED" | "GRANTED">("READY");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("VERIFYING");
    const res = await signIn("credentials", {
      username: username.trim(),
      password,
      redirect: false,
    });
    if (res?.ok) {
      setStatus("GRANTED");
      // Read callbackUrl from the URL here (client-only handler) instead of the
      // useSearchParams hook, so this page stays statically prerenderable.
      const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl") || "/admin";
      setTimeout(() => { router.push(callbackUrl); router.refresh(); }, 350);
    } else {
      setStatus("DENIED");
    }
  };

  const statusLabel =
    status === "VERIFYING" ? "Verifying…"
    : status === "GRANTED"  ? "Access granted"
    : status === "DENIED"   ? "Invalid username or password"
    : null;
  const statusColor =
    status === "DENIED"  ? "#FF4D4D"
    : status === "GRANTED" ? "#4A9EFF"
    : "rgba(255,255,255,0.35)";

  return (
    <div className="flex min-h-screen flex-col relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[50vh] w-[60vw] rounded-full bg-[#4A9EFF]/[0.04] blur-[120px] pointer-events-none" />

      <div className="flex justify-center px-6 pt-6">
        <div className="glass rounded-full flex items-center gap-3 px-5 py-2.5">
          <VotelytLogo size={22} />
          <BrandName className="font-sans font-semibold text-[1rem] text-white" />
        </div>
      </div>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-white/35 mb-5">Console access</p>
          <h1 className="font-sans font-extrabold text-white tracking-tight leading-[1.05] mb-10"
            style={{ fontSize: "clamp(2.8rem, 8vw, 4.5rem)" }}>
            Welcome<br />back.
          </h1>

          <form onSubmit={handleSubmit}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 space-y-6">
            <div>
              <label className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-white/40 mb-2 block">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); if (status === "DENIED") setStatus("READY"); }}
                placeholder="you"
                autoFocus
                required
                autoComplete="username"
                className="field-glass"
              />
            </div>
            <div>
              <label className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-white/40 mb-2 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (status === "DENIED") setStatus("READY"); }}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="field-glass text-[1.1rem] tracking-[0.12em]"
              />
            </div>

            {statusLabel && (
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em]" style={{ color: statusColor }}>
                {statusLabel}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "VERIFYING"}
              className="btn btn-primary w-full"
            >
              {status === "VERIFYING" ? "Verifying…" : <>Enter Console <span aria-hidden="true">⟶</span></>}
            </button>

            <p className="text-center text-[0.82rem] text-white/40">
              No account?{" "}
              <Link href="/admin/signup" className="text-[#4A9EFF] hover:text-[#7DC4FF] transition-colors">
                Create one
              </Link>
            </p>
          </form>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
