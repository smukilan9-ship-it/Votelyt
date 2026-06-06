"use client";
import { useEffect, useRef } from "react";

interface Props {
  src: string;
  className?: string;
  style?: React.CSSProperties;
}

export function HlsVideo({ src, className, style }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: import("hls.js").default | undefined;

    async function init() {
      const Hls = (await import("hls.js")).default;
      if (Hls.isSupported()) {
        hls = new Hls({ autoStartLoad: true, lowLatencyMode: false });
        hls.loadSource(src);
        hls.attachMedia(video!);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video!.play().catch(() => {});
        });
      } else if (video!.canPlayType("application/vnd.apple.mpegurl")) {
        video!.src = src;
        video!.play().catch(() => {});
      }
    }

    init();
    return () => hls?.destroy();
  }, [src]);

  return (
    <video
      ref={videoRef}
      className={className}
      style={style}
      muted
      loop
      playsInline
      autoPlay
    />
  );
}
