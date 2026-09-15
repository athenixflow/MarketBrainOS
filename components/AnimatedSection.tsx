import React from 'react';
import { motion, useReducedMotion, HTMLMotionProps } from 'framer-motion';

interface AnimatedSectionProps extends HTMLMotionProps<'div'> {
  /** Position in the sequence — drives the staggered reveal delay. */
  index?: number;
  /** Rendered element. Use "section" to preserve semantic markup. */
  as?: 'div' | 'section';
}

/**
 * Wraps content in a scroll-triggered fade-in. Sections reveal sequentially
 * via a per-index delay, and motion is skipped entirely when the user has
 * requested reduced motion.
 */
const AnimatedSection: React.FC<AnimatedSectionProps> = ({
  index = 0,
  as = 'div',
  children,
  ...rest
}) => {
  const reduce = useReducedMotion();
  // The prerender (scripts/prerender.ts) sets this flag. Under it there is no start state at all, so
  // the static HTML can never carry opacity:0 - which it did for every below-fold section until the
  // Sep 2026 QA audit - regardless of observer timing. Real visitors still get the reveal.
  const still = reduce || (typeof window !== 'undefined' && (window as any).__MBOS_PRERENDER === true);
  const Comp: any = as === 'section' ? motion.section : motion.div;

  return (
    <Comp
      initial={still ? false : { opacity: 0, y: 24 }}
      whileInView={still ? undefined : { opacity: 1, y: 0 }}
      // amount 0.2 never fired for sections taller than five viewports (the pricing/features blocks
      // on a phone), so they stayed at opacity:0 for good. Any visible sliver now reveals the section.
      viewport={{ once: true, amount: 0.01 }}
      // The stagger is capped: late sections on a long page must not wait 1s+ after scrolling into view.
      transition={{ duration: 0.5, ease: 'easeOut', delay: Math.min(index, 4) * 0.08 }}
      {...rest}
    >
      {children}
    </Comp>
  );
};

export default AnimatedSection;
