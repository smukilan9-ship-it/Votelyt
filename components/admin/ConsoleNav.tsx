"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Vote } from "lucide-react";
import { BrandName, VotelytLogo } from "@/components/ui/Brand";

const nav = [
  { href: "/admin", label: "Home", exact: true },
  { href: "/admin/elections/new", label: "Create Election", exact: false },
];

export function ConsoleNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const logout = () => signOut({ callbackUrl: "/admin/login" });
  const isActive = (href: string, exact: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 px-4 pt-5 pb-2 sm:px-6">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
        {/* Brand → control panel home */}
        <Link href="/admin" className="glass rounded-full flex items-center gap-3 px-4 py-2.5 shrink-0">
          <VotelytLogo size={22} />
          <BrandName className="font-sans font-semibold text-[1rem] text-white" />
          <span className="hidden md:inline font-mono text-[0.58rem] uppercase tracking-[0.18em] text-white/55 ml-1">Console</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-2">
          <div className="glass rounded-full flex items-center gap-5 px-5 py-2.5">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="text-[0.8rem] font-medium tracking-wide transition-colors duration-200"
                style={{ color: isActive(n.href, n.exact) ? "#fff" : "rgba(255,255,255,0.62)" }}>
                {n.label}
              </Link>
            ))}
            <div className="h-3 w-px bg-white/[0.1]" />
            <button onClick={logout} className="text-[0.78rem] font-medium text-white/60 hover:text-red-400 transition-colors duration-200">
              Sign out
            </button>
          </div>
          {/* Always-visible Vote shortcut */}
          <Link href="/vote" className="inline-flex items-center gap-2 rounded-full bg-[#4A9EFF] px-5 py-2.5 text-[0.8rem] font-semibold text-black hover:bg-[#7DC4FF] transition-colors">
            <Vote size={15} /> Vote
          </Link>
        </nav>

        {/* Mobile: Vote always visible + menu toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <Link href="/vote" className="inline-flex items-center gap-1.5 rounded-full bg-[#4A9EFF] px-4 py-2.5 text-[0.78rem] font-semibold text-black">
            <Vote size={14} /> Vote
          </Link>
          <button onClick={() => setOpen((o) => !o)} aria-label="Menu" className="glass rounded-full p-2.5 text-white/70">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="md:hidden mx-auto mt-2 max-w-[1400px]"
          >
            <div className="glass rounded-2xl p-3 flex flex-col">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-[0.95rem] font-medium transition-colors"
                  style={{ color: isActive(n.href, n.exact) ? "#fff" : "rgba(255,255,255,0.55)" }}>
                  {n.label}
                </Link>
              ))}
              <Link href="/vote" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-[0.95rem] font-medium text-[#4A9EFF]">
                Vote
              </Link>
              <button onClick={logout} className="rounded-xl px-4 py-3 text-left text-[0.95rem] font-medium text-red-400">
                Sign out
              </button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
