// Global docs search — a command-palette modal. Filters the article index live, supports keyboard
// navigation, and jumps to the best-matching section (via a react-router hash, safe under HashRouter).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchDocs } from '../../config/docs/registry';
import Icon from './icons';

const DocsSearch: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const results = useMemo(() => searchDocs(query), [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  if (!open) return null;

  const go = (i: number) => {
    const r = results[i];
    if (!r) return;
    onClose();
    navigate(`/documentation/${r.article.categoryId}/${r.article.id}${r.anchorId ? `#${r.anchorId}` : ''}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(active); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4" role="dialog" aria-modal="true" aria-label="Search documentation">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0F0F0F] border border-gray-800 rounded-3xl shadow-2xl overflow-hidden" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
          <Icon name="search" className="w-5 h-5 text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the docs — tools, tokens, roles, billing…"
            className="flex-1 bg-transparent outline-none text-[15px] text-white placeholder:text-gray-600"
          />
          <button onClick={onClose} className="text-[9px] font-bold uppercase tracking-widest text-gray-500 border border-gray-700 rounded-lg px-2 py-1 hover:text-white hover:border-gray-500 transition-colors">Esc</button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-600">Type at least two characters to search.</p>
          ) : results.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-600">No results for “{query}”.</p>
          ) : (
            <ul className="py-2">
              {results.map((r, i) => (
                <li key={`${r.article.categoryId}/${r.article.id}`}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(i)}
                    className={`w-full text-left px-5 py-3 flex flex-col gap-0.5 transition-colors ${i === active ? 'bg-[#FF0000]/10' : 'hover:bg-white/5'}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{r.category.title}</span>
                      {r.anchorText && <><span className="text-gray-700">/</span><span className="text-[9px] font-bold uppercase tracking-widest text-[#FF0000]">{r.anchorText}</span></>}
                    </span>
                    <span className="text-sm font-bold text-white">{r.article.title}</span>
                    <span className="text-[12px] text-gray-500 leading-snug truncate">{r.snippet}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-4 px-5 py-2.5 border-t border-gray-800 text-[10px] font-bold uppercase tracking-widest text-gray-600">
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
};

export default DocsSearch;
