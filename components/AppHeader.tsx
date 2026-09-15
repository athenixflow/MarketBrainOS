// The signed-in app header. Extracted from App.tsx so it can be mounted on its own - the browser
// harness renders it at 640/768/1024/1280 and asserts nothing overlaps, which is how the QA
// report's "logo runs into FEATURES at 768px" finding is kept closed.

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationCenter from './NotificationCenter';
import ScopeSwitcher from './ScopeSwitcher';

interface AppHeaderProps {
  onToggleSidebar?: () => void;
  /** Mirrors the sidebar drawer so the hamburger can report `aria-expanded`. */
  isSidebarOpen?: boolean;
}

// Width budget at 768px (QA saw "Sign In" wrapping and the wordmark colliding): the row has 720px;
// the full wordmark plus a ScopeSwitcher cluster needed ~790. So the wordmark is "MBOS" until `lg`,
// the upgrade link is a compact pill until `lg`, ScopeSwitcher waits until `md` (it lives in the
// sidebar drawer below that), and the brand cluster is the only thing allowed to shrink.
const AppHeader: React.FC<AppHeaderProps> = ({ onToggleSidebar, isSidebarOpen = false }) => {
  // isSystemLocked comes from one auth-gated subscription in AuthContext. This used to be a local
  // 10s poller here and an identical one in AppContainer.
  const { user, profile, signOut, isSystemLocked: isEmergency } = useAuth();
  const location = useLocation();
  // Ensure title reflects Admin only if user is authorized
  const isAdminRole = profile?.role === 'super_admin' || profile?.role === 'ops_admin';
  const isAdminPath = location.pathname.startsWith('/admin') && isAdminRole;

  return (
    <header className="h-16 bg-[#0B0B0B] bg-opacity-95 backdrop-blur-2xl flex items-center gap-4 px-4 sm:px-6 lg:px-12 fixed top-0 left-0 right-0 border-b border-gray-900/30 z-20">
      {/* Brand cluster: the only part allowed to shrink, so it owns min-w-0 / overflow-hidden. */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 overflow-hidden">
        {user && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-expanded={isSidebarOpen}
            aria-controls="app-sidebar"
            aria-label="Open navigation"
            className="lg:hidden shrink-0 text-gray-400 hover:text-white p-1"
          >
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        )}
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 shrink-0 bg-[#FF0000] rounded-[10px] flex items-center justify-center font-bold text-white text-xs shadow-2xl shadow-[#FF0000]/20 transform -rotate-6 transition-transform hover:rotate-0">M</div>
          {/* Hidden below sm: at 375px the right cluster measures 220px, which leaves the brand 107px for
              142px of hamburger + tile + "MBOS"; the tile alone carries the brand there. */}
          <h1 className="hidden sm:block text-sm font-bold tracking-[0.2em] text-white uppercase whitespace-nowrap truncate">
            <span className="lg:hidden">{isAdminPath ? 'MBOS Admin' : 'MBOS'}</span>
            <span className="hidden lg:inline">{isAdminPath ? 'MarketBrainOS Admin' : 'MarketBrainOS'}</span>
          </h1>
        </Link>
      </div>

      {/* Right cluster: fixed-width children, never clipped (ScopeSwitcher and NotificationCenter open popovers here). */}
      <div className="ml-auto flex items-center shrink-0 gap-3 sm:gap-4 lg:gap-8 xl:gap-10">
        <nav aria-label="Account" className="flex items-center gap-4 lg:gap-6 text-[11px] font-bold tracking-widest text-gray-500 uppercase">
          {!isAdminPath && profile?.tier === 'free' && (
            <>
              {/* No animate-pulse: red already carries the emphasis, and it was the only perpetually moving chrome. */}
              <Link
                to="/pricing"
                aria-label="Upgrade to Pro"
                className="lg:hidden shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-[#FF0000]/40 text-[#FF0000] text-[10px] whitespace-nowrap hover:bg-[#FF0000] hover:text-white transition-colors"
              >
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
                </svg>
                Pro
              </Link>
              <Link to="/pricing" className="hidden lg:inline shrink-0 whitespace-nowrap text-[#FF0000] hover:text-white transition-colors">Upgrade to Pro</Link>
            </>
          )}
          <Link to="/documentation" className="hidden sm:inline shrink-0 whitespace-nowrap hover:text-white transition-colors">Docs</Link>
          <Link to="/documentation" aria-label="Documentation" className="sm:hidden shrink-0 hover:text-white transition-colors">?</Link>
          {user ? (
            <button type="button" onClick={signOut} className="shrink-0 whitespace-nowrap hover:text-white transition-colors uppercase tracking-widest font-bold">Sign out</button>
          ) : (
            <Link to="/auth" className="shrink-0 whitespace-nowrap hover:text-white transition-colors">Sign in</Link>
          )}
        </nav>
        {user && !isAdminPath && <div className="hidden md:block shrink-0"><ScopeSwitcher /></div>}
        {user && !isAdminPath && <div className="shrink-0"><NotificationCenter /></div>}
        <div aria-hidden="true" className={`w-1.5 h-1.5 shrink-0 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.3)] ${isEmergency ? 'bg-red-500' : 'bg-green-500/80'}`} />
      </div>
    </header>
  );
};

export default AppHeader;
