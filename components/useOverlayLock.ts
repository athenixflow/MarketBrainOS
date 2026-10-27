import { useEffect, useRef, useState } from 'react';

/**
 * While `open`: Escape calls onClose, and the page behind stops scrolling. body { overflow: hidden }
 * is ignored by iOS Safari, so the body is fixed at its current offset and restored on close.
 *
 * onClose is read through a ref: callers pass inline arrows, and re-running the effect on every
 * render would release and re-take the lock with the body already fixed (scrollY 0), sending the
 * page back to the top when it closes.
 */
export const useOverlayLock = (open: boolean, onClose: () => void) => {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    document.addEventListener('keydown', onKey);
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    return () => {
      document.removeEventListener('keydown', onKey);
      body.style.position = prev.position; body.style.top = prev.top; body.style.width = prev.width; body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);
};

/** True while the media query matches (the app drawer only behaves as an overlay below `lg`). */
export const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
};
