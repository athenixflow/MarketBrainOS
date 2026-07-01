// Left navigation: category → article tree with active highlighting. Used as a fixed rail on
// desktop and a slide-over drawer on mobile (controlled by DocsLayout).

import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { DOC_CATEGORIES, articlesByCategory } from '../../config/docs/registry';
import Icon from './icons';

const DocsSidebar: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { categoryId, articleId } = useParams();

  return (
    <nav aria-label="Documentation" className="space-y-8">
      {DOC_CATEGORIES.map((cat) => {
        const articles = articlesByCategory(cat.id);
        const catActive = categoryId === cat.id;
        return (
          <div key={cat.id}>
            <Link
              to={`/documentation/${cat.id}`}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 mb-3 text-[11px] font-bold uppercase tracking-widest transition-colors ${catActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Icon name={cat.icon} className={`w-4 h-4 ${catActive ? 'text-[#FF0000]' : ''}`} />
              {cat.title}
            </Link>
            <ul className="space-y-0.5 ml-1 border-l border-gray-800/80">
              {articles.map((a) => {
                const active = catActive && articleId === a.id;
                return (
                  <li key={a.id}>
                    <Link
                      to={`/documentation/${a.categoryId}/${a.id}`}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={`block -ml-px border-l-2 pl-4 py-1.5 text-[13px] leading-snug transition-colors ${
                        active ? 'border-[#FF0000] text-white font-semibold' : 'border-transparent text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {a.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
};

export default DocsSidebar;
