import { useEffect, useState } from 'react';

/**
 * Tracks which section heading is currently in view for the in-article table of contents.
 * Returns the id of the last heading scrolled past (the "active" section). A scroll listener is
 * used rather than IntersectionObserver so short sections near the bottom still activate reliably.
 */
export const useScrollSpy = (ids: string[], offset = 140): string => {
  const [active, setActive] = useState<string>('');

  useEffect(() => {
    if (!ids.length) { setActive(''); return; }

    const handler = () => {
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - offset <= 0) current = id;
        else break;
      }
      // At the very bottom of the page, force the last heading active.
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 4) {
        current = ids[ids.length - 1];
      }
      setActive(current);
    };

    handler();
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|'), offset]);

  return active;
};

/** Smooth-scroll to an element id, honouring reduced-motion, and update the hash. */
export const scrollToHeading = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
};

export default useScrollSpy;
