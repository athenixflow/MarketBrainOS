import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const LINKS = [
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
  { to: '/documentation', label: 'Docs' },
];

const PublicNav: React.FC = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 bg-[#0B0B0B]/90 backdrop-blur-xl border-b border-gray-900/50">
      <div className="max-w-7xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-4" onClick={() => setOpen(false)}>
          <div className="w-8 h-8 bg-[#FF0000] rounded-lg flex items-center justify-center font-bold text-white text-xs transform -rotate-6 transition-transform hover:rotate-0">M</div>
          <span className="text-sm font-bold tracking-[0.2em] text-white uppercase">MarketBrainOS</span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-8">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-[11px] font-bold uppercase tracking-widest transition-colors ${location.pathname === l.to ? 'text-white' : 'text-gray-500 hover:text-white'}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-6">
          <Link to="/auth" className="text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">Sign In</Link>
          <Link to="/auth" className="text-[11px] font-bold uppercase tracking-widest bg-[#FF0000] text-white px-5 py-2.5 rounded-xl hover:bg-[#D40000] transition-colors">Start Free</Link>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen((o) => !o)} className="md:hidden text-gray-300 p-1" aria-label="Menu">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d={open ? 'M6 18L18 6M6 6l12 12' : 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5'} />
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-gray-900/50 px-6 py-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="block text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">
              {l.label}
            </Link>
          ))}
          <div className="pt-4 flex items-center gap-4 border-t border-gray-900/50">
            <Link to="/auth" onClick={() => setOpen(false)} className="text-xs font-bold uppercase tracking-widest text-gray-400">Sign In</Link>
            <Link to="/auth" onClick={() => setOpen(false)} className="text-xs font-bold uppercase tracking-widest bg-[#FF0000] text-white px-4 py-2 rounded-xl">Start Free</Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default PublicNav;
