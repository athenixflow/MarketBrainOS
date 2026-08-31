// Branded catch-all 404. Renders in two layouts: full-bleed for logged-out visitors (public marketing
// chrome absent) and inside the app shell for signed-in users. It inherits the #0B0B0B background from
// AppContainer in both cases, and adapts its primary CTA + helpful links to the auth state.
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PrimaryButton } from '../components/UI';

const NotFound: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Signed-in users get in-app destinations; visitors get marketing pages.
  const quickLinks = user
    ? [
        { to: '/history', label: 'History' },
        { to: '/reports', label: 'Reports' },
        { to: '/documentation', label: 'Docs' },
        { to: '/support', label: 'Support' },
      ]
    : [
        { to: '/features', label: 'Features' },
        { to: '/pricing', label: 'Pricing' },
        { to: '/about', label: 'About' },
        { to: '/faq', label: 'FAQ' },
      ];

  return (
    // A signed-in user renders inside the shell's container, which already supplies page padding, so
    // adding our own gave 104px side padding and 160px on top. A signed-out visitor renders full-bleed
    // (no container at all) and must bring its own.
    <div
      className={`min-h-[60vh] flex flex-col items-center justify-center text-center animate-in fade-in duration-500 ${
        user ? 'py-10' : 'px-6 py-20'
      }`}
    >
      {/* Brand mark — only when logged out (the app header/sidebar already brand the signed-in view). */}
      {!user && (
        <Link to="/" className="flex items-center gap-3 mb-14">
          <div className="w-9 h-9 bg-[#FF0000] rounded-xl flex items-center justify-center font-black text-white transform -rotate-6">M</div>
          <span className="text-sm font-bold tracking-[0.2em] text-white uppercase">MarketBrain OS</span>
        </Link>
      )}

      {/* Oversized ghost 404 with a red accent bar struck through it. */}
      <div className="relative mb-4">
        <span className="block text-[120px] md:text-[190px] font-black leading-none tracking-tighter text-white/[0.05] select-none">404</span>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-[3px] bg-[#FF0000] rounded-full" />
        </div>
      </div>

      <p className="text-[10px] font-black text-[#FF0000] uppercase tracking-[0.4em] mb-6">Page not found</p>
      <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-5 max-w-xl">
        This page doesn’t exist — or it moved.
      </h1>
      <p className="text-gray-500 font-medium leading-relaxed max-w-md mb-12">
        The link may be broken, or the page may have been retired. Let’s get you back to something useful.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <Link to="/">
          <PrimaryButton className="!px-10">{user ? 'Back to dashboard' : 'Back to home'}</PrimaryButton>
        </Link>
        <button
          onClick={() => navigate(-1)}
          className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white transition-colors border-b border-gray-800 hover:border-gray-500 pb-1"
        >
          ← Go back
        </button>
      </div>

      <div className="flex items-center gap-8 mt-16 pt-8 border-t border-gray-900/60 w-full max-w-md justify-center flex-wrap">
        {quickLinks.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-[#FF0000] transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default NotFound;
