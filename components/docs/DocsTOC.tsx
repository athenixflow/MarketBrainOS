// In-article table of contents (right rail). Highlights the section in view via scroll-spy and
// smooth-scrolls on click. Hidden on narrower screens (the article headings still anchor via hash).

import React, { useMemo } from 'react';
import { DocArticle, articleHeadings } from '../../config/docs/types';
import { useScrollSpy, scrollToHeading } from './useScrollSpy';

const DocsTOC: React.FC<{ article: DocArticle }> = ({ article }) => {
  const headings = useMemo(() => articleHeadings(article), [article]);
  const ids = useMemo(() => headings.map((h) => h.id), [headings]);
  const active = useScrollSpy(ids);

  if (headings.length < 2) return null;

  return (
    <nav aria-label="On this page" className="hidden xl:block w-56 shrink-0">
      <div className="sticky top-24">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">On this page</p>
        <ul className="space-y-1 border-l border-gray-800">
          {headings.map((h) => {
            const isActive = active === h.id;
            return (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  aria-current={isActive ? 'location' : undefined}
                  onClick={(e) => { e.preventDefault(); scrollToHeading(h.id); }}
                  className={`block -ml-px border-l-2 pl-4 py-1.5 text-[13px] leading-snug transition-colors ${
                    isActive ? 'border-[#FF0000] text-white font-semibold' : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {h.text}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

export default DocsTOC;
