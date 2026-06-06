"use client";

interface AuroraBackgroundProps {
  variant?: "blue" | "green" | "mixed";
  intensity?: number;
}

export function AuroraBackground({ variant = "blue", intensity = 1 }: AuroraBackgroundProps) {
  const palettes = {
    blue: [
      "radial-gradient(ellipse 70% 60% at 20% 30%, #1a5fbf 0%, transparent 70%)",
      "radial-gradient(ellipse 80% 50% at 80% 70%, #0d3a7a 0%, transparent 65%)",
      "radial-gradient(ellipse 60% 70% at 50% 10%, #4a9eff 0%, transparent 60%)",
      "radial-gradient(ellipse 90% 40% at 10% 90%, #2b7fe0 0%, transparent 70%)",
    ],
    green: [
      "radial-gradient(ellipse 70% 60% at 20% 30%, #0d5c3a 0%, transparent 70%)",
      "radial-gradient(ellipse 80% 50% at 80% 70%, #1a7a4a 0%, transparent 65%)",
      "radial-gradient(ellipse 60% 70% at 50% 10%, #2dbe7c 0%, transparent 60%)",
      "radial-gradient(ellipse 90% 40% at 10% 90%, #0a4a2e 0%, transparent 70%)",
    ],
    mixed: [
      "radial-gradient(ellipse 70% 60% at 20% 30%, #1a5fbf 0%, transparent 70%)",
      "radial-gradient(ellipse 80% 50% at 80% 70%, #0d5c3a 0%, transparent 65%)",
      "radial-gradient(ellipse 60% 70% at 55% 15%, #4a9eff 0%, transparent 60%)",
      "radial-gradient(ellipse 90% 40% at 10% 85%, #1a7a4a 0%, transparent 70%)",
    ],
  };

  const colors = palettes[variant];

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ opacity: intensity, zIndex: 0 }}
    >
      {/* blob 1 */}
      <div
        className="aurora-blob-1 absolute"
        style={{
          width: "70vw",
          height: "60vh",
          top: "-15%",
          left: "-10%",
          background: colors[0],
          filter: "blur(60px)",
          opacity: 0.18,
          borderRadius: "60% 40% 55% 45% / 50% 60% 40% 50%",
        }}
      />
      {/* blob 2 */}
      <div
        className="aurora-blob-2 absolute"
        style={{
          width: "60vw",
          height: "70vh",
          bottom: "-20%",
          right: "-10%",
          background: colors[1],
          filter: "blur(80px)",
          opacity: 0.15,
          borderRadius: "45% 55% 40% 60% / 60% 45% 55% 40%",
        }}
      />
      {/* blob 3 */}
      <div
        className="aurora-blob-3 absolute"
        style={{
          width: "50vw",
          height: "50vh",
          top: "20%",
          right: "5%",
          background: colors[2],
          filter: "blur(70px)",
          opacity: 0.12,
          borderRadius: "55% 45% 60% 40% / 45% 55% 45% 55%",
        }}
      />
      {/* blob 4 */}
      <div
        className="aurora-blob-4 absolute"
        style={{
          width: "45vw",
          height: "45vh",
          bottom: "10%",
          left: "15%",
          background: colors[3],
          filter: "blur(90px)",
          opacity: 0.1,
          borderRadius: "50% 50% 55% 45% / 55% 50% 50% 45%",
        }}
      />
      {/* subtle noise grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
