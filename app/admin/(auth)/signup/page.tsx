"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { BrandName, VotelytLogo } from "@/components/ui/Brand";
import { Footer } from "@/components/ui/Chrome";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Sign up failed" }));
        setError(error ?? "Sign up failed");
        setLoading(false);
        return;
      }
      // Auto sign-in on success.
      const signInRes = await signIn("credentials", {
        username: username.trim(),
        password,
        redirect: false,
      });
      if (signInRes?.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        router.push("/admin/login");
      }
    } catch {
      setError("Sign up failed");
      setLoading(false);
    }
  };

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
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-white/35 mb-5">Get started</p>
          <h1 className="font-sans font-extrabold text-white tracking-tight leading-[1.05] mb-10"
            style={{ fontSize: "clamp(2.8rem, 8vw, 4.5rem)" }}>
            Create your<br />account.
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
                onChange={(e) => { setUsername(e.target.value); setError(null); }}
                placeholder="you"
                autoFocus
                required
                autoComplete="username"
                className="field-glass"
              />
              <p className="mt-2 font-mono text-[0.6rem] text-white/30">3–32 chars · letters, numbers, dot, dash, underscore</p>
            </div>
            <div>
              <label className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-white/40 mb-2 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="field-glass text-[1.1rem] tracking-[0.12em]"
              />
            </div>
            <div>
              <label className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-white/40 mb-2 block">
                Confirm password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="field-glass text-[1.1rem] tracking-[0.12em]"
              />
            </div>

            {error && (
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em]" style={{ color: "#FF4D4D" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? "Creating…" : <>Create account <span aria-hidden="true">⟶</span></>}
            </button>

            <p className="text-center text-[0.82rem] text-white/40">
              Already have an account?{" "}
              <Link href="/admin/login" className="text-[#4A9EFF] hover:text-[#7DC4FF] transition-colors">
                Sign in
              </Link>
            </p>
          </form>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
