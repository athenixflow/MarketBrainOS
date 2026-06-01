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
  const Comp: any = as === 'section' ? motion.section : motion.div;

  return (
    <Comp
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: index * 0.12 }}
      {...rest}
    >
      {children}
    </Comp>
  );
};

export default AnimatedSection;
