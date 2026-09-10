import React, { useEffect, useRef, useState } from 'react';
import type { VideoAsset } from './types';

interface HeroVideoProps {
  asset: VideoAsset;
  className?: string;
}

/**
 * Muted, looping, decorative background video.
 *
 * - Serves the 720p file below the lg breakpoint and the 1080p file above it (chosen once on mount, so the
 *   prerendered HTML carries only the poster and the browser never downloads two videos).
 * - Renders the poster only under prefers-reduced-motion or Data Saver: the still frame is the same picture
 *   the video opens on, so nothing is lost, and nothing moves.
 * - aria-hidden: it is atmosphere, not content. The headline next to it is the content.
 */
const HeroVideo: React.FC<HeroVideoProps> = ({ asset, className = '' }) => {
  const [src, setSrc] = useState<string | null>(null);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    // The build-time prerender (headless Chrome) snapshots the DOM; keep that snapshot poster-only so the
    // static HTML never carries a <video> that every visitor would start fetching before React mounts.
    const prerendering = navigator.webdriver === true;
    if (reduce || saveData || prerendering) return;
    const wide = window.matchMedia('(min-width: 1024px)').matches;
    setSrc(wide || !asset.mp4Mobile ? asset.mp4 : asset.mp4Mobile);
  }, [asset]);

  // Some browsers ignore autoPlay on a src set after mount; nudge it, and swallow the rejection if blocked.
  useEffect(() => {
    if (!src || !ref.current) return;
    const p = ref.current.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, [src]);

  return (
    <div aria-hidden="true" className={`absolute inset-0 overflow-hidden bg-[#0B0B0B] ${className}`}>
      {/* Poster paints immediately (also the reduced-motion / data-saver state).
          A real <img>, not a CSS background: this is the LCP element on the homepage, and a background
          image is only discovered after CSS parses and the element lays out, so the browser's preload
          scanner never saw it. Measured desktop LCP was 3056ms against a 2500ms target while mobile,
          which skips the video entirely, managed 1264ms. width/height are set to keep CLS at 0. */}
      <picture>
        {asset.posterWebp && <source type="image/webp" srcSet={asset.posterWebp} />}
        <img
          src={asset.poster}
          alt=""
          width={asset.width}
          height={asset.height}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </picture>
      {src && (
        <video
          ref={ref}
          src={src}
          poster={asset.poster}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          disablePictureInPicture
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
};

export default HeroVideo;
