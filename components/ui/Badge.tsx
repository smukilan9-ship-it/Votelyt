interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  dot?: boolean;
}

const tones: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "text-white/35 border-white/[0.08] bg-white/[0.03]",
  success: "text-[#4A9EFF] border-[#4A9EFF]/25 bg-[#4A9EFF]/[0.08]",
  warning: "text-amber-400 border-amber-400/25 bg-amber-400/[0.06]",
  danger: "text-red-400 border-red-400/20 bg-red-400/[0.05]",
  info: "text-white/70 border-white/[0.1] bg-white/[0.04]",
};

export function Badge({ children, variant = "default", dot = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] ${tones[variant]}`}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "currentColor" }} />
      )}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps["variant"]; dot: boolean }> = {
    DRAFT: { label: "Setup", variant: "default", dot: false },
    ACTIVE: { label: "Live", variant: "success", dot: true },
    ENDED: { label: "Closed", variant: "info", dot: false },
  };
  const cfg = map[status] ?? { label: status, variant: "default" as const, dot: false };
  return (
    <Badge variant={cfg.variant} dot={cfg.dot}>
      {cfg.label}
    </Badge>
  );
}
