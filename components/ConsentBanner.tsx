// Analytics consent banner. Google Analytics is OFF until the visitor accepts here (the gate lives in
// services/firebase.ts); essential auth/session storage is always on and is not what this asks about.
// Renders only while no choice is stored. Not modal: no focus trap, no backdrop, no body lock. A slim
// full-width bottom bar; while open it reserves its own height as body padding so it never covers a
// page's primary action (the first version, a 344px sheet, hid the sign-in submit and cut the hero).
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CONSENT_STORAGE_KEY, CONSENT_ANALYTICS_YES, CONSENT_ANALYTICS_NO,
  readStoredConsent, enableAnalytics, disableAnalytics,
} from '../services/firebase';

type Decision = 'yes' | 'no';

const ConsentBanner: React.FC = () => {
  const titleId = useId();
  const descId = useId();
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLElement>(null);

  // Reserve the bar's height below the page content so nothing sits underneath it.
  useLayoutEffect(() => {
    if (!open || !barRef.current) return;
    const el = barRef.current;
    // Body padding lengthens flowing pages; the custom property lets viewport-sized layouts
    // (AuthShell's 100dvh grid) shrink instead, so bottom-anchored links stay above the bar.
    const apply = () => {
      document.body.style.paddingBottom = `${el.offsetHeight}px`;
      document.documentElement.style.setProperty('--mbos-consent-h', `${el.offsetHeight}px`);
    };
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      document.body.style.paddingBottom = '';
      document.documentElement.style.removeProperty('--mbos-consent-h');
    };
  }, [open]);

  useEffect(() => {
    // The build-time prerender sets this flag so no static snapshot bakes the banner in. It is NOT
    // navigator.webdriver: the browser test drives a real Puppeteer session and must see the banner.
    if ((window as any).__MBOS_PRERENDER) return;
    if (readStoredConsent() === null) setOpen(true);
  }, []);

  if (!open) return null;

  const decide = (d: Decision) => {
    // Storage may be blocked (private mode, disabled site data): the choice then holds for this
    // session only and the banner returns next load, which is the safe direction to fail.
    try { localStorage.setItem(CONSENT_STORAGE_KEY, d === 'yes' ? CONSENT_ANALYTICS_YES : CONSENT_ANALYTICS_NO); } catch { /* session-only */ }
    if (d === 'yes') enableAnalytics(); else disableAnalytics();
    setOpen(false);
  };

  return (
    <section
      ref={barRef}
      role="region"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed z-[45] inset-x-0 bottom-0 bg-[#121212] text-white border-t border-gray-800 shadow-2xl shadow-black/50 px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-sm font-bold tracking-tight text-white">Can we measure how the product is used?</h2>
          <p id={descId} className="text-xs text-gray-400 leading-snug mt-0.5">
            Anonymous usage analytics, only if you accept. Sign-in cookies are always on.{' '}
            <Link to="/privacy#s11" className="font-bold text-gray-300 underline underline-offset-2 hover:text-white transition-colors">Privacy policy §11</Link>
          </p>
        </div>
      <div className="flex items-center gap-3 shrink-0">
        {/* Native buttons, not PrimaryButton/SecondaryButton: the ids are a contract with
            scripts/browser-harness.ts (it clicks #consent-accept) and the shared buttons take no id.
            Recipes are PrimaryButton size="sm" and SecondaryButton size="sm" tone="dark" verbatim;
            py-3 on Decline matches the 40px height of the primary so the pair sits on one baseline. */}
        <button
          id="consent-accept"
          type="button"
          onClick={() => decide('yes')}
          className="flex-1 sm:flex-none h-10 bg-[#FF0000] text-white px-5 text-[11px] font-bold rounded-2xl shadow-sm hover:bg-[#D40000] active:scale-[0.99] transition-all duration-300 tracking-widest uppercase whitespace-nowrap"
        >
          Accept analytics
        </button>
        <button
          id="consent-decline"
          type="button"
          onClick={() => decide('no')}
          className="flex-1 sm:flex-none h-10 bg-transparent border px-5 text-[11px] font-bold rounded-2xl transition-all duration-300 tracking-widest uppercase active:scale-[0.99] text-white border-gray-700 hover:border-white hover:bg-white/5 whitespace-nowrap"
        >
          Decline
        </button>
      </div>
      </div>
    </section>
  );
};

export default ConsentBanner;
