// A single documentation article: breadcrumbs, title, structured body, prev/next, and the right TOC.

import React, { useEffect } from 'react';
import { useParams, useLocation, Link, Navigate } from 'react-router-dom';
import { getArticle, getCategory, articleNeighbours } from '../../config/docs/registry';
import DocsBlocks from './DocsBlocks';
import DocsTOC from './DocsTOC';
import { scrollToHeading } from './useScrollSpy';
import Icon from './icons';
import Seo from '../Seo';
import { SITE_URL, SITE_NAME, DOCS_LAST_UPDATED, canonicalUrl } from '../../config/seo';

const DocArticle: React.FC = () => {
  const { categoryId, articleId } = useParams();
  const location = useLocation();
  const article = getArticle(categoryId, articleId);
  const category = getCategory(categoryId);

  // On navigation: jump to the #anchor (set via react-router) or to the top.
  useEffect(() => {
    const hash = location.hash.replace(/^#/, '');
    if (hash) {
      // Wait a tick for the article to render before scrolling to the section.
      const t = setTimeout(() => scrollToHeading(hash), 60);
      return () => clearTimeout(t);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [categoryId, articleId, location.hash]);

  if (!article || !category) return <Navigate to="/documentation" replace />;

  const { prev, next } = articleNeighbours(article);
  const path = `/documentation/${article.categoryId}/${article.id}`;
  const url = canonicalUrl(path);
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: article.title,
    description: article.summary,
    url,
    inLanguage: 'en-US',
    dateModified: DOCS_LAST_UPDATED,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${SITE_URL}/apple-touch-icon.png` } },
    isPartOf: { '@id': `${SITE_URL}/#website` },
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Docs', item: `${SITE_URL}/documentation` },
      { '@type': 'ListItem', position: 2, name: category.title, item: `${SITE_URL}/documentation/${category.id}` },
      { '@type': 'ListItem', position: 3, name: article.title, item: url },
    ],
  };

  return (
    <div className="flex gap-12 w-full">
      <Seo title={article.title} description={article.summary} path={path} ogType="article" jsonLd={[articleJsonLd, breadcrumbJsonLd]} />
      <article className="min-w-0 flex-1 max-w-3xl">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-6">
          <Link to="/documentation" className="hover:text-white transition-colors">Docs</Link>
          <Icon name="chevronRight" className="w-3 h-3 text-gray-700" />
          <Link to={`/documentation/${category.id}`} className="hover:text-white transition-colors">{category.title}</Link>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight mb-4">{article.title}</h1>
          <div className="w-12 h-[2px] bg-[#FF0000] rounded-full mb-5" />
          <p className="text-lg text-gray-400 font-medium leading-relaxed">{article.summary}</p>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-600 mt-5">Last updated {DOCS_LAST_UPDATED}</p>
        </header>

        {/* Body card */}
        <div className="bg-white text-[#0B0B0B] rounded-2xl p-7 lg:p-12 shadow-[0_15px_50px_rgba(0,0,0,0.15)]">
          <DocsBlocks blocks={article.blocks} />
        </div>

        {/* Prev / Next */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10">
          {prev ? (
            <Link to={`/documentation/${prev.categoryId}/${prev.id}`} className="group rounded-2xl border border-gray-800 hover:border-gray-600 bg-[#111] p-5 transition-colors">
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2"><Icon name="arrowLeft" className="w-3.5 h-3.5" /> Previous</span>
              <span className="text-sm font-bold text-white group-hover:text-[#FF0000] transition-colors">{prev.title}</span>
            </Link>
          ) : <span />}
          {next ? (
            <Link to={`/documentation/${next.categoryId}/${next.id}`} className="group rounded-2xl border border-gray-800 hover:border-gray-600 bg-[#111] p-5 transition-colors text-right sm:col-start-2">
              <span className="flex items-center justify-end gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Next <Icon name="arrowRight" className="w-3.5 h-3.5" /></span>
              <span className="text-sm font-bold text-white group-hover:text-[#FF0000] transition-colors">{next.title}</span>
            </Link>
          ) : <span />}
        </div>
      </article>

      <DocsTOC article={article} />
    </div>
  );
};

export default DocArticle;
