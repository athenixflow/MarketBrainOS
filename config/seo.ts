// SEO constants + per-page metadata. Single source of truth for the canonical origin, site name,
// default social image, and the marketing-page copy consumed by <Seo> (components/Seo.tsx).

export const SITE_URL = 'https://www.marketbrainos.app';
export const SITE_NAME = 'MarketBrain OS';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

// Freshness signal for docs (visible "Last updated" + Article dateModified). Bump when docs change.
export const DOCS_LAST_UPDATED = '2026-07-01';

/** Absolute canonical URL for a route path (root normalizes to a trailing slash). */
export const canonicalUrl = (path: string): string => {
  if (!path || path === '/') return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export interface PageSeo { title: string; description: string; path: string; }

// Marketing / public routes. Titles that already contain the brand are used verbatim; others get
// " | MarketBrain OS" appended by <Seo>.
export const MARKETING_SEO: Record<string, PageSeo> = {
  home: {
    title: 'MarketBrain OS | AI Marketing Intelligence & Conversion Optimization Platform',
    description: 'MarketBrain OS is an AI marketing intelligence platform. Validate strategy, audit landing pages, simulate ad performance, and generate high-converting angles before you spend.',
    path: '/',
  },
  features: {
    title: 'Features',
    description: "Explore MarketBrain OS's 13 AI marketing tools across five suites — audience, market, competitor, messaging, campaign, offer, growth, conversion, and workflow intelligence.",
    path: '/features',
  },
  pricing: {
    title: 'Pricing & Plans',
    description: 'Simple, transparent pricing for MarketBrain OS. Free, Pro, Team, Agency, and Enterprise plans with monthly token allowances on paid plans and pay-as-you-go top-ups.',
    path: '/pricing',
  },
  about: {
    title: 'About',
    description: 'The mission behind MarketBrain OS — the decision-support operating system that turns marketing guesswork into data-backed, AI-driven intelligence.',
    path: '/about',
  },
  faq: {
    title: 'Frequently Asked Questions',
    description: 'Answers to common questions about MarketBrain OS — how tokens work, pricing, the tools included, data handling, and how to get started.',
    path: '/faq',
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How MarketBrain OS collects, uses, stores, and protects your data — including account information, analysis content, AI processing, and your privacy rights.',
    path: '/privacy',
  },
  terms: {
    title: 'Terms of Service',
    description: 'The terms governing your use of MarketBrain OS — accounts, plans and tokens, acceptable use, AI-output disclaimers, and your rights and responsibilities.',
    path: '/terms',
  },
};
