// Per-route <head> manager. Emits a unique title, description, canonical, Open Graph, Twitter, and
// optional JSON-LD for the current page via react-helmet-async. The prerender step (scripts/
// prerender.ts) runs the real app in a browser so these tags are baked into each static HTML file —
// which is what non-JS crawlers (all AI bots + Bing) and social scrapers actually read.

import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SITE_NAME, DEFAULT_OG_IMAGE, canonicalUrl } from '../config/seo';

interface SeoProps {
  title: string;
  description: string;
  path: string;
  ogType?: string;                 // 'website' (default) | 'article' | 'product'
  image?: string;                  // absolute URL; defaults to the site OG image
  jsonLd?: object | object[];      // structured data to embed
  noindex?: boolean;
}

const Seo: React.FC<SeoProps> = ({ title, description, path, ogType = 'website', image, jsonLd, noindex }) => {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const url = canonicalUrl(path);
  const img = image || DEFAULT_OG_IMAGE;
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex, follow" />}
      <link rel="canonical" href={url} />

      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={img} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={img} />

      {blocks.map((b, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(b)}</script>
      ))}
    </Helmet>
  );
};

export default Seo;
