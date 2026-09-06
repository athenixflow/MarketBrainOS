// "Who uses MarketBrainOS" as a pinned scroll story. On large screens the section pins for one
// viewport while scrolling steps through the audiences: the image crossfades on the left, the copy
// swaps on the right, and a red progress line fills 1:1 with the scroll position. Below lg, and for
// users who prefer reduced motion, it renders as a plain stacked list instead - pinned sections fight
// the mobile address bar and a crossfade carousel is exactly what reduced-motion users ask not to see.
import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useMotionValueEvent } from 'framer-motion';
import AnimatedSection from '../AnimatedSection';
import Picture from '../media/Picture';
import type { ImageAsset } from '../media/types';

export interface Audience {
  title: string;
  desc: string;
  asset: ImageAsset | null;
}

interface AudienceStoryProps {
  audiences: Audience[];
  /** Position of this section on the page - drives the fallback's staggered reveal. */
  index?: number;
}

const HEADING = 'Who Uses MarketBrainOS?';
const pad = (n: number) => String(n).padStart(2, '0');

// Prerender-safe media query: the prerender runs in a real browser, so `window` exists there too.
const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState<boolean>(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return matches;
};

// Critically damped: the copy settles without overshoot. Nothing in this brand bounces.
const SWAP = { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

const AudienceStory: React.FC<AudienceStoryProps> = ({ audiences, index = 0 }) => {
  const reduce = useReducedMotion();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  if (reduce || !isDesktop) return <AudienceList audiences={audiences} index={index} />;
  return <PinnedStory audiences={audiences} />;
};

// --- Fallback: the audiences as cards, no pinning, no crossfade -------------------------------------
const AudienceList: React.FC<AudienceStoryProps> = ({ audiences, index = 0 }) => (
  <AnimatedSection
    as="section"
    index={index}
    className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-b border-gray-900/50"
    aria-labelledby="audience-heading"
    data-audience-list
  >
    <h2 id="audience-heading" className="text-3xl font-bold text-white mb-12">{HEADING}</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {audiences.map((a) => (
        <div key={a.title} data-audience-item className="border border-gray-800 rounded-2xl bg-[#0F0F0F] overflow-hidden flex flex-col">
          {a.asset && (
            <Picture asset={a.asset} sizes="(min-width: 768px) 50vw, 100vw" className="border-b border-gray-800" imgClassName="aspect-[2/1] object-cover" />
          )}
          <div className="p-6 sm:p-8">
            <h3 className="text-xl font-bold text-white mb-4">{a.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{a.desc}</p>
          </div>
        </div>
      ))}
    </div>
  </AnimatedSection>
);

// --- Pinned story -----------------------------------------------------------------------------------
const PinnedStory: React.FC<{ audiences: Audience[] }> = ({ audiences }) => {
  const n = audiences.length;
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  // 0 when the section's top reaches the viewport top (stage pins), 1 when its bottom reaches the
  // viewport bottom (stage unpins). Each audience owns an equal slice of that range.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const toIndex = (p: number) => Math.min(n - 1, Math.max(0, Math.floor(p * n)));
  useMotionValueEvent(scrollYProgress, 'change', (p) => setActive((prev) => (prev === toIndex(p) ? prev : toIndex(p))));
  // A reload mid-section lands on the right step instead of the first one.
  useEffect(() => { setActive(toIndex(scrollYProgress.get())); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToStep = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const pinned = el.offsetHeight - window.innerHeight;
    // +2px so the boundary is crossed and this step, not the previous one, becomes active.
    window.scrollTo({ top: top + (i / n) * pinned + 2, behavior: 'smooth' });
  };

  return (
    <section
      ref={ref}
      aria-labelledby="audience-heading"
      data-audience-story
      className="relative border-b border-gray-900/50"
      // One viewport for the stage plus 80vh of scroll per audience beyond the first.
      style={{ height: `${100 + (n - 1) * 80}vh` }}
    >
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20 items-center"
        >
          {/* Image frame: every audience image is mounted and stacked; only the active one is opaque. */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-gray-800 bg-[#0F0F0F]">
            {audiences.map((a, i) => (
              <motion.div
                key={a.title}
                aria-hidden={i !== active}
                initial={false}
                animate={{ opacity: i === active ? 1 : 0, scale: i === active ? 1 : 1.04 }}
                transition={SWAP}
                className="absolute inset-0 will-change-[opacity,transform]"
              >
                {a.asset && (
                  <Picture asset={a.asset} sizes="(min-width: 1024px) 45vw, 100vw" priority={i === 0} className="h-full" imgClassName="h-full object-cover" />
                )}
              </motion.div>
            ))}
          </div>

          <div className="min-w-0">
            <h2 id="audience-heading" className="text-3xl font-bold text-white mb-8">{HEADING}</h2>

            {/* Progress line: fills 1:1 with scroll; the dots are also a quick way to jump between steps. */}
            <div className="relative h-px bg-gray-800 mb-10">
              <motion.div style={{ scaleX: scrollYProgress }} className="absolute inset-y-0 left-0 w-full bg-[#FF0000] origin-left" />
              <ol className="absolute inset-0 flex justify-between items-center -mx-1.5">
                {audiences.map((a, i) => (
                  <li key={a.title}>
                    <button
                      type="button"
                      onClick={() => scrollToStep(i)}
                      aria-label={`Go to ${a.title}`}
                      aria-current={i === active ? 'step' : undefined}
                      className="block p-2 -m-2 group"
                    >
                      <span className={`block w-3 h-3 rounded-full border transition-colors duration-300 ${i <= active ? 'bg-[#FF0000] border-[#FF0000]' : 'bg-[#0B0B0B] border-gray-700 group-hover:border-gray-400'}`} />
                    </button>
                  </li>
                ))}
              </ol>
            </div>

            {/* Copy: all steps share one grid cell so the block keeps the height of the tallest one.
                Inactive steps stay in the accessibility tree; only pointer interaction is switched off. */}
            <div className="grid">
              {audiences.map((a, i) => (
                <motion.div
                  key={a.title}
                  initial={false}
                  animate={{ opacity: i === active ? 1 : 0, y: i === active ? 0 : i < active ? -16 : 16 }}
                  transition={SWAP}
                  className={`col-start-1 row-start-1 ${i === active ? '' : 'pointer-events-none'}`}
                >
                  <h3 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] mb-6">{a.title}</h3>
                  <p className="text-gray-400 text-lg leading-relaxed max-w-xl">{a.desc}</p>
                </motion.div>
              ))}
            </div>

            <p data-audience-counter className="mt-10 text-[11px] font-bold text-gray-500 uppercase tracking-widest tabular-nums">
              {`${pad(active + 1)} / ${pad(n)}`}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AudienceStory;
