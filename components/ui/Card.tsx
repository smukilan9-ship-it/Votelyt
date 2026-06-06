import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg" | "none";
  hover?: boolean;
}

/** A hairline-framed surface. No shadow, no blur. Corners 2px. */
export function Card({ children, className = "", padding = "md", hover = false }: CardProps) {
  const paddings = { none: "", sm: "p-4", md: "p-6", lg: "p-8" };
  return (
    <div
      className={`rounded-[2px] border border-[var(--hairline)] bg-[var(--ink-raised)] ${
        hover ? "transition-colors hover:border-[var(--hairline-strong)]" : ""
      } ${paddings[padding]} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mb-5 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`font-serif text-lg font-medium tracking-tight text-bone ${className}`}>
      {children}
    </h2>
  );
}
