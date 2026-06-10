"use client";
import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const DURATION = 4500;

/* Each type carries an accent colour, a clear text label, AND a glyph — so the
   meaning never depends on colour alone (WCAG 1.4.1). */
const META: Record<ToastType, { accent: string; label: string; glyph: string }> = {
  success: { accent: "#34D399", label: "Success", glyph: "✓" },
  error:   { accent: "var(--destructive)", label: "Error", glyph: "!" },
  warning: { accent: "#FBBF24", label: "Warning", glyph: "△" },
  info:    { accent: "var(--blue)", label: "Note", glyph: "i" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Polite region for non-error toasts; assertive errors set their own role/aria-live below. */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[120] flex max-w-sm flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const meta = META[toast.type];
  const isError = toast.type === "error";

  // Pause-on-hover: track remaining time so a paused toast resumes where it
  // left off rather than restarting its full duration.
  const remaining = useRef(DURATION);
  // Set in startTimer (which runs from the mount effect), never read before then,
  // so it starts at 0 rather than calling the impure Date.now() during render.
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTimer = useCallback(() => {
    startedAt.current = Date.now();
    timer.current = setTimeout(onDismiss, remaining.current);
  }, [onDismiss]);

  const pauseTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    remaining.current -= Date.now() - startedAt.current;
  }, []);

  useEffect(() => {
    startTimer();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [startTimer]);

  return (
    <motion.div
      // Errors interrupt assertively; everything else is announced politely.
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      onFocusCapture={pauseTimer}
      onBlurCapture={startTimer}
      tabIndex={0}
      className="pointer-events-auto flex items-start gap-3 rounded-xl border border-white/[0.1] border-l-2 bg-[var(--ink-raised)] px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
      style={{ borderLeftColor: meta.accent }}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.7rem] font-bold"
        style={{ background: `${meta.accent}22`, color: meta.accent }}
      >
        {meta.glyph}
      </span>
      <div className="min-w-0">
        <p className="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.08em]" style={{ color: meta.accent }}>
          {meta.label}
        </p>
        <p className="mt-0.5 text-sm leading-snug text-white/85">{toast.message}</p>
      </div>
    </motion.div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
