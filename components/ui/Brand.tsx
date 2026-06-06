import Link from "next/link";

export function VotelytLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Votelyt">
      <circle cx="18" cy="18" r="14" fill="url(#votelyt-g)" />
      <circle cx="13.4" cy="11.8" r="10.8" fill="url(#votelyt-crescent)" />
      <defs>
        <radialGradient id="votelyt-g" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(23.5 23.5) rotate(-135) scale(20)">
          <stop stopColor="#7DC4FF" />
          <stop offset="0.46" stopColor="#4A9EFF" />
          <stop offset="1" stopColor="#1A5FBF" />
        </radialGradient>
        <radialGradient id="votelyt-crescent" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(7.8 6.2) rotate(45) scale(17.6)">
          <stop stopColor="#000000" />
          <stop offset="0.62" stopColor="#000000" />
          <stop offset="1" stopColor="#1A5FBF" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function LogoMark({ size = 32 }: { size?: number }) {
  return <VotelytLogo size={size} />;
}

export function BrandName({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span>Vote</span><span className="text-[#4A9EFF]">lyt</span>
    </span>
  );
}

export function Wordmark({ href = "/" }: { href?: string | null; size?: number }) {
  const inner = (
    <span className="flex items-center gap-3">
      <VotelytLogo size={30} />
      <BrandName className="font-sans font-semibold text-[1.05rem] text-white" />
    </span>
  );
  if (href === null) return inner;
  return (
    <Link href={href} className="inline-flex transition-opacity hover:opacity-75">{inner}</Link>
  );
}
