/**
 * Route transition. A solid ink mask is held briefly, then wipes upward as the
 * incoming content resolves up beneath it. CSS-driven so the covering mask
 * always reaches its hidden end-state — it never strands the page behind ink.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="route-mask" aria-hidden />
      <div className="route-content">{children}</div>
    </div>
  );
}
