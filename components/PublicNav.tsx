import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LINKS = [
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
  { to: '/documentation', label: 'Docs' },
];

// Layout budget (QA found the wordmark touching FEATURES and both CTAs wrapping at exactly 768px):
// the wordmark (~208px), five links and two CTAs need ~720px, and a 768px row has 672px. So the link
// row waits until `lg` (the hamburger menu covers 768-1023), every link and CTA is `whitespace-nowrap
// shrink-0`, and the brand is the only element allowed to shrink (it truncates instead of wrapping).
const PublicNav: React.FC = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  // PublicLayout renders inside AuthProvider, so a signed-in visitor gets one "Open app" pill
  // instead of being asked to sign in again.
  const { user } = useAuth();
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 bg-[#0B0B0B]/90 backdrop-blur-xl border-b border-gray-900/50">
      <div className="max-w-7xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-3 lg:gap-4 py-2 -my-2 min-w-0" onClick={close}>
          <div className="w-9 h-9 shrink-0 bg-[#FF0000] rounded-[10px] flex items-center justify-center font-bold text-white text-xs transform -rotate-6 transition-transform hover:rotate-0">M</div>
          <span className="text-sm font-bold tracking-[0.2em] text-white uppercase whitespace-nowrap min-w-0 truncate">MarketBrainOS</span>
        </Link>

        {/* Desktop links */}
        <nav aria-label="Site" className="hidden lg:flex items-center gap-6 xl:gap-8 shrink-0">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`whitespace-nowrap shrink-0 text-[11px] font-bold uppercase tracking-widest transition-colors ${location.pathname === l.to ? 'text-white' : 'text-gray-500 hover:text-white'}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4 xl:gap-6 shrink-0">
          {user ? (
            <Link to="/" className="hidden md:inline whitespace-nowrap shrink-0 text-[11px] font-bold uppercase tracking-widest bg-white/5 border border-gray-800 text-gray-200 px-4 py-2 rounded-xl hover:bg-white/10 transition-colors">Open app</Link>
          ) : (
            <>
              {/* /auth opens in sign-in mode, so "Start Free" covers both paths where there is no room for two CTAs. */}
              <Link to="/auth" className="hidden lg:inline whitespace-nowrap shrink-0 text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors py-4 -my-4">Sign In</Link>
              <Link to="/auth" className="hidden md:inline whitespace-nowrap shrink-0 text-[11px] font-bold uppercase tracking-widest bg-[#FF0000] text-white px-5 py-2.5 rounded-xl hover:bg-[#D40000] transition-colors">Start Free</Link>
            </>
          )}

          {/* Menu toggle: carries the links below lg and everything below md. */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="public-nav-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="lg:hidden shrink-0 text-gray-300 p-3 -mr-3"
          >
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d={open ? 'M6 18L18 6M6 6l12 12' : 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5'} />
            </svg>
          </button>
        </div>
      </div>

      {/* Menu (below lg) */}
      {open && (
        <div id="public-nav-menu" className="lg:hidden border-t border-gray-900/50 px-6 md:px-12 py-4 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} onClick={close} className="block py-4 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">
              {l.label}
            </Link>
          ))}
          <div className="pt-4 flex items-center gap-4 border-t border-gray-900/50">
            {user ? (
              <Link to="/" onClick={close} className="text-xs font-bold uppercase tracking-widest bg-white/5 border border-gray-800 text-gray-200 px-4 py-2 rounded-xl">Open app</Link>
            ) : (
              <>
                <Link to="/auth" onClick={close} className="text-xs font-bold uppercase tracking-widest text-gray-400 py-3.5 -my-1">Sign In</Link>
                <Link to="/auth" onClick={close} className="text-xs font-bold uppercase tracking-widest bg-[#FF0000] text-white px-4 py-2 rounded-xl">Start Free</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default PublicNav;
