// Docs hub landing: hero with a prominent search trigger, a grid of category cards, and a set of
// popular quick-links.

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DOC_CATEGORIES, articleCount, getArticle } from '../../config/docs/registry';
import { useDocsSearch } from './DocsLayout';
import Icon from './icons';

const POPULAR: { cat: string; id: string }[] = [
  { cat: 'getting-started', id: 'first-analysis' },
  { cat: 'tools', id: 'overview' },
  { cat: 'billing', id: 'how-tokens-work' },
  { cat: 'organizations', id: 'agency-hub' },
  { cat: 'billing', id: 'plans-compared' },
  { cat: 'reference', id: 'token-costs' },
];

const DocsHome: React.FC = () => {
  const { openSearch } = useDocsSearch();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, []);

  return (
    <div>
      {/* Hero */}
      <section className="mb-16">
        <p className="text-[11px] font-bold text-[#FF0000] uppercase tracking-[0.3em] mb-5">Documentation</p>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.1] mb-6 max-w-3xl">
          Everything you need to master MarketBrain&nbsp;OS
        </h1>
        <p className="text-lg text-gray-400 font-medium leading-relaxed max-w-2xl mb-8">
          Detailed guides for every tool, the token economy, plans and billing, the collaboration
          layers, and the admin console. Search, or browse by category below.
        </p>
        <button
          onClick={openSearch}
          className="group w-full max-w-xl flex items-center gap-3 bg-[#141414] border border-gray-800 hover:border-gray-600 rounded-2xl px-5 py-4 text-left transition-colors"
        >
          <Icon name="search" className="w-5 h-5 text-gray-500" />
          <span className="text-[15px] text-gray-500 flex-1">Search the docs — tools, tokens, roles, billing…</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600 border border-gray-700 rounded px-2 py-1">Ctrl K</span>
        </button>
      </section>

      {/* Category grid */}
      <section className="mb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DOC_CATEGORIES.map((cat) => (
            <Link key={cat.id} to={`/documentation/${cat.id}`}
              className="group rounded-2xl border border-gray-800 hover:border-gray-600 bg-[#111] p-6 transition-colors flex gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FF0000]/10 text-[#FF0000] flex items-center justify-center shrink-0 group-hover:bg-[#FF0000]/20 transition-colors">
                <Icon name={cat.icon} className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white group-hover:text-[#FF0000] transition-colors mb-1 flex items-center gap-2">
                  {cat.title}
                  <span className="text-[10px] font-bold text-gray-600">{articleCount(cat.id)}</span>
                </h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">{cat.summary}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Popular */}
      <section>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Popular guides</p>
        <div className="flex flex-wrap gap-2.5">
          {POPULAR.map(({ cat, id }) => {
            const a = getArticle(cat, id);
            if (!a) return null;
            return (
              <Link key={`${cat}/${id}`} to={`/documentation/${cat}/${id}`}
                className="text-[13px] font-semibold text-gray-300 bg-white/5 border border-gray-800 hover:border-gray-600 hover:text-white rounded-full px-4 py-2 transition-colors">
                {a.title}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default DocsHome;
