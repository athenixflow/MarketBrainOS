// Category landing: a heading plus a card grid of the articles in that category.

import React, { useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { getCategory, articlesByCategory } from '../../config/docs/registry';
import Icon from './icons';
import Seo from '../Seo';
import { SITE_NAME, SITE_URL } from '../../config/seo';

const DocsCategory: React.FC = () => {
  const { categoryId } = useParams();
  const category = getCategory(categoryId);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [categoryId]);

  if (!category) return <Navigate to="/documentation" replace />;
  const articles = articlesByCategory(category.id);

  // Category pages had only the sitewide Organization/SoftwareApplication schema, while the articles
  // beneath them already ship TechArticle + BreadcrumbList (see DocArticle). CollectionPage states what
  // this page is, and the breadcrumb mirrors the visual one rendered below.
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: category.title,
    description: category.summary,
    url: `${SITE_URL}/documentation/${category.id}`,
    inLanguage: 'en-US',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@type': 'Organization', name: SITE_NAME },
    hasPart: articles.map((a) => ({
      '@type': 'TechArticle',
      headline: a.title,
      description: a.summary,
      url: `${SITE_URL}/documentation/${category.id}/${a.id}`,
    })),
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Docs', item: `${SITE_URL}/documentation` },
      { '@type': 'ListItem', position: 2, name: category.title, item: `${SITE_URL}/documentation/${category.id}` },
    ],
  };

  return (
    <div className="max-w-4xl">
      <Seo title={category.title} description={category.summary} path={`/documentation/${category.id}`} jsonLd={[collectionJsonLd, breadcrumbJsonLd]} />
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-6">
        <Link to="/documentation" className="hover:text-white transition-colors">Docs</Link>
        <Icon name="chevronRight" className="w-3 h-3 text-gray-700" />
        <span className="text-gray-300">{category.title}</span>
      </nav>

      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-[#FF0000]/10 text-[#FF0000] flex items-center justify-center">
          <Icon name={category.icon} className="w-6 h-6" />
        </div>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white">{category.title}</h1>
      </div>
      <p className="text-lg text-gray-400 font-medium leading-relaxed mb-10 max-w-2xl">{category.summary}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {articles.map((a) => (
          <Link key={a.id} to={`/documentation/${a.categoryId}/${a.id}`}
            className="group rounded-2xl border border-gray-800 hover:border-gray-600 bg-[#111] p-6 transition-colors">
            <h3 className="text-base font-bold text-white group-hover:text-[#FF0000] transition-colors mb-2">{a.title}</h3>
            <p className="text-[13px] text-gray-500 leading-relaxed">{a.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default DocsCategory;
