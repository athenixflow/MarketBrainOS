// Docs shell: adaptive top nav, sticky left sidebar (slide-over on mobile), the routed content
// outlet, the search modal, and the public footer. Owns search + drawer state and exposes an
// openSearch() via context so the hero and nav can trigger the same modal.

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PublicFooter from '../PublicFooter';
import DocsSidebar from './DocsSidebar';
import DocsSearch from './DocsSearch';
import Icon from './icons';

const SearchCtx = createContext<{ openSearch: () => void }>({ openSearch: () => {} });
export const useDocsSearch = () => useContext(SearchCtx);

const DocsLayout: React.FC = () => {
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Global shortcuts: "/" focuses search, Ctrl/Cmd+K opens it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setSearchOpen(true); }
      else if (e.key === '/' && !typing && !searchOpen) { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  return (
    <SearchCtx.Provider value={{ openSearch: () => setSearchOpen(true) }}>
      <div className="min-h-screen bg-[#0B0B0B] text-white flex flex-col">
        {/* Top nav */}
        <header className="sticky top-0 z-40 bg-[#0B0B0B]/90 backdrop-blur-xl border-b border-gray-900/50">
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setDrawerOpen(true)} className="lg:hidden text-gray-300 p-1" aria-label="Open navigation">
                <Icon name="menu" className="w-6 h-6" />
              </button>
              <Link to="/documentation" className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#FF0000] rounded-lg flex items-center justify-center font-bold text-white text-xs transform -rotate-6">M</div>
                <span className="text-sm font-bold tracking-[0.2em] text-white uppercase hidden sm:inline">Docs</span>
              </Link>
            </div>

            <button
              onClick={() => setSearchOpen(true)}
              className="group flex-1 max-w-md flex items-center gap-3 bg-[#141414] border border-gray-800 hover:border-gray-600 rounded-xl px-4 py-2.5 text-left transition-colors"
            >
              <Icon name="search" className="w-4 h-4 text-gray-500" />
              <span className="text-[13px] text-gray-500 flex-1">Search the docs…</span>
              <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-widest text-gray-600 border border-gray-700 rounded px-1.5 py-0.5">Ctrl K</span>
            </button>

            <div className="flex items-center gap-4 shrink-0">
              {user ? (
                <Link to="/" className="text-[11px] font-bold uppercase tracking-[0.15em] bg-white/5 border border-gray-800 text-gray-200 px-4 py-2 rounded-xl hover:bg-white/10 transition-colors">Open app</Link>
              ) : (
                <>
                  <Link to="/auth" className="hidden sm:inline text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 hover:text-white transition-colors">Sign In</Link>
                  <Link to="/auth" className="text-[11px] font-bold uppercase tracking-[0.15em] bg-[#FF0000] text-white px-4 py-2 rounded-xl hover:bg-[#D40000] transition-colors">Start Free</Link>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 w-full max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-10 flex gap-10 py-10">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 no-scrollbar">
              <DocsSidebar />
            </div>
          </aside>

          {/* Mobile drawer */}
          {drawerOpen && (
            <div className="lg:hidden fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
              <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-[#0B0B0B] border-r border-gray-800 p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                  <span className="text-sm font-bold tracking-[0.2em] text-white uppercase">Docs</span>
                  <button onClick={() => setDrawerOpen(false)} className="text-gray-400 p-1" aria-label="Close navigation"><Icon name="close" className="w-5 h-5" /></button>
                </div>
                <DocsSidebar onNavigate={() => setDrawerOpen(false)} />
              </div>
            </div>
          )}

          {/* Content */}
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>

        <PublicFooter />
      </div>

      <DocsSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </SearchCtx.Provider>
  );
};

export default DocsLayout;
