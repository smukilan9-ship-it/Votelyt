"use client";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * A page heading that feels alive: a soft blue light tracks the cursor across
 * the text, and the whole heading lifts slightly toward the pointer. Subtle by
 * design — no constant animation. Respects prefers-reduced-motion (the effect
 * simply doesn't engage if the pointer never moves).
 */
export function InteractiveHeading({
  as: Tag = "h1",
  className = "",
  style,
  children,
}: {
  as?: "h1" | "h2" | "h3";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  const active = pos !== null;
  const backgroundImage = active
    ? `radial-gradient(60% 120% at ${pos!.x}% ${pos!.y}%, #BFE0FF 0%, #7DC4FF 25%, #ffffff 55%)`
    : undefined;

  return (
    <Tag
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setPos(null)}
      className={className}
      style={{
        ...style,
        backgroundImage,
        WebkitBackgroundClip: active ? "text" : undefined,
        backgroundClip: active ? "text" : undefined,
        WebkitTextFillColor: active ? "transparent" : undefined,
        transition: "transform 0.35s cubic-bezier(0.22,1,0.36,1)",
        transform: active ? `translateY(-2px)` : "none",
        willChange: "transform",
      }}
    >
      {children}
    </Tag>
  );
}
