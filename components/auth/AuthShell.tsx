// Split-screen shell for every auth/onboarding surface (sign in, sign up, reset, action handler).
//
// Composition: a dark brand panel (left) sits beside a full-height white form panel (right). The two
// halves are one deliberate composition seen at once, not a mid-scroll theme flip, and the white panel
// keeps the product's established "light surface on near-black" language while removing the floating
// rounded card that made the old page read as a phone mockup.
//
// Design tokens for this surface: accent #FF0000 only, radius rounded-2xl on every interactive element
// (rounded-full reserved for dot markers), brand near-black #0B0B0B.
import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

// Honest product claims, drawn from the real feature set and free-plan behaviour.
const VALUE_POINTS = [
  {
    title: 'Thirteen analysis tools',
    body: 'Audience, market, messaging, campaign, offer, and conversion intelligence in one place.',
  },
  {
    title: 'Results you can compare',
    body: 'Every analysis returns the same rigorous structure, so you can act on it instead of decoding it.',
  },
  {
    title: 'Start free',
    body: 'A monthly token allowance on the Free plan. No card required to begin.',
  },
];

export const BrandMark: React.FC<{ className?: string; showWordmark?: boolean }> = ({
  className = '',
  showWordmark = true,
}) => (
  <Link to="/" className={`inline-flex items-center gap-3 group ${className}`}>
    <div className="w-9 h-9 bg-[#FF0000] rounded-2xl flex items-center justify-center font-black text-white text-sm transform -rotate-6 transition-transform duration-500 group-hover:rotate-0">
      M
    </div>
    {showWordmark && (
      <span className="text-sm font-bold tracking-[0.2em] uppercase">MarketBrain OS</span>
    )}
  </Link>
);

const AuthShell: React.FC<{
  /** Form-panel heading, e.g. "Welcome back". */
  title: string;
  /** One short line under the heading. */
  subtitle: string;
  children: React.ReactNode;
  /** Optional row pinned under the form (sign-in / sign-up switch). */
  footer?: React.ReactNode;
}> = ({ title, subtitle, children, footer }) => {
  const reduce = useReducedMotion();
  const year = new Date().getFullYear();

  // Entry motion is motivated: the form is the action on this page, so it resolves first and the
  // supporting brand copy staggers in behind it.
  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const, delay: reduce ? 0 : delay },
  });

  return (
    <div className="min-h-[100dvh] w-full bg-[#0B0B0B] lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ---------- Brand panel (desktop only; collapses into the form header on mobile) ---------- */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 overflow-hidden">
        {/* Brand-red ambient wash. Low opacity, single hue, no competing gradient. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,0,0,0.12),transparent_58%)]"
        />

        <motion.div {...rise(0.05)} className="relative text-white">
          <BrandMark />
        </motion.div>

        <div className="relative max-w-md">
          <motion.h2
            {...rise(0.12)}
            className="text-4xl xl:text-[2.75rem] font-black text-white tracking-tight leading-[1.1] mb-12"
          >
            Decisions, pressure-tested before you spend.
          </motion.h2>

          <ul className="space-y-8">
            {VALUE_POINTS.map((p, i) => (
              <motion.li key={p.title} {...rise(0.2 + i * 0.08)}>
                <div className="w-8 h-[2px] bg-[#FF0000] rounded-full mb-4" />
                <h3 className="text-white font-bold text-[15px] mb-2">{p.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{p.body}</p>
              </motion.li>
            ))}
          </ul>
        </div>

        <motion.div
          {...rise(0.45)}
          className="relative flex items-center gap-6 text-[11px] font-bold uppercase tracking-widest text-gray-600"
        >
          <span>&copy; {year} MarketBrain OS</span>
          <Link to="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
        </motion.div>
      </aside>

      {/* ---------- Form panel (a section, not a main: AppContainer already renders the page main) ---------- */}
      <section className="relative bg-white flex flex-col min-h-[100dvh] lg:min-h-0">
        <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14 xl:px-20">
          <motion.div {...rise(0)} className="w-full max-w-[420px] mx-auto">
            {/* Mobile-only brand mark, since the brand panel is hidden below lg. */}
            <div className="lg:hidden mb-10 text-[#0B0B0B]">
              <BrandMark />
            </div>

            <h1 className="text-3xl sm:text-[2rem] font-black text-[#0B0B0B] tracking-tight leading-tight mb-3">
              {title}
            </h1>
            <p className="text-[15px] text-gray-600 leading-relaxed mb-10">{subtitle}</p>

            {children}
          </motion.div>
        </div>

        {footer && (
          <div className="px-6 pb-10 sm:px-10 lg:px-14 xl:px-20">
            <div className="w-full max-w-[420px] mx-auto pt-6 border-t border-gray-100">{footer}</div>
          </div>
        )}

        {/* Mobile legal row; the desktop equivalent lives in the brand panel. */}
        <div className="lg:hidden px-6 pb-8 sm:px-10">
          <div className="w-full max-w-[420px] mx-auto flex items-center gap-5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <span>&copy; {year} MarketBrain OS</span>
            <Link to="/privacy" className="hover:text-[#0B0B0B] transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-[#0B0B0B] transition-colors">Terms</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AuthShell;
