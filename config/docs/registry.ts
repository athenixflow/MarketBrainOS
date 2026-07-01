// Docs registry — the single assembled source of truth for the documentation hub.
// Combines the category content modules into ordered categories + a flat article list, and provides
// lookups plus a lightweight client-side search over titles, section headings, keywords, and text.

import { DocArticle, DocCategory, DocSearchResult, articleText, articleHeadings } from './types';
import { gettingStartedArticles } from './gettingStarted';
import { toolArticles } from './toolDocs';
import { billingArticles } from './tokensBilling';
import { organizationsArticles } from './collaboration';
import { accountArticles } from './account';
import { adminArticles } from './admin';
import { referenceArticles } from './reference';

export const DOC_CATEGORIES: DocCategory[] = [
  { id: 'getting-started', title: 'Getting Started', icon: 'rocket', summary: 'Orientation, core concepts, and your first analysis.' },
  { id: 'tools', title: 'Analysis Tools', icon: 'sparkles', summary: 'Exhaustive guides for all 13 tools across five suites.' },
  { id: 'billing', title: 'Tokens, Plans & Billing', icon: 'coin', summary: 'How tokens work, plan tiers, the store, and billing.' },
  { id: 'organizations', title: 'Collaboration & Organizations', icon: 'users', summary: 'Scopes, Team, Agency, Enterprise, and roles.' },
  { id: 'account', title: 'Account & Settings', icon: 'gear', summary: 'Profile, settings, history, and reports.' },
  { id: 'admin', title: 'Admin — Control Center', icon: 'shield', summary: 'The governance console for platform administrators.' },
  { id: 'reference', title: 'Reference', icon: 'book', summary: 'Token costs, glossary, limits, and support.' },
];

const ARTICLES_BY_CATEGORY: Record<string, DocArticle[]> = {
  'getting-started': gettingStartedArticles,
  'tools': toolArticles,
  'billing': billingArticles,
  'organizations': organizationsArticles,
  'account': accountArticles,
  'admin': adminArticles,
  'reference': referenceArticles,
};

export const DOC_ARTICLES: DocArticle[] = DOC_CATEGORIES.flatMap((c) => ARTICLES_BY_CATEGORY[c.id] || []);

export const getCategory = (id: string | undefined): DocCategory | undefined =>
  DOC_CATEGORIES.find((c) => c.id === id);

export const articlesByCategory = (id: string): DocArticle[] => ARTICLES_BY_CATEGORY[id] || [];

export const getArticle = (categoryId: string | undefined, articleId: string | undefined): DocArticle | undefined =>
  DOC_ARTICLES.find((a) => a.categoryId === categoryId && a.id === articleId);

export const articleCount = (categoryId: string): number => articlesByCategory(categoryId).length;

// Ordered [prev, next] neighbours within the same category, for article footer navigation.
export const articleNeighbours = (article: DocArticle): { prev?: DocArticle; next?: DocArticle } => {
  const list = articlesByCategory(article.categoryId);
  const i = list.findIndex((a) => a.id === article.id);
  return { prev: i > 0 ? list[i - 1] : undefined, next: i >= 0 && i < list.length - 1 ? list[i + 1] : undefined };
};

// Pre-built lowercase search index (title, category, keywords, headings, full text).
interface IndexEntry {
  article: DocArticle;
  title: string;
  headings: { id: string; text: string; lc: string }[];
  keywords: string;
  text: string;
}

const INDEX: IndexEntry[] = DOC_ARTICLES.map((article) => ({
  article,
  title: article.title.toLowerCase(),
  headings: articleHeadings(article).map((h) => ({ ...h, lc: h.text.toLowerCase() })),
  keywords: (article.keywords || []).join(' ').toLowerCase(),
  text: articleText(article).toLowerCase(),
}));

const makeSnippet = (text: string, needle: string): string => {
  const i = text.indexOf(needle);
  if (i < 0) return text.slice(0, 120).trim();
  const start = Math.max(0, i - 40);
  return `${start > 0 ? '…' : ''}${text.slice(start, i + needle.length + 80).trim()}…`;
};

/**
 * Rank articles for a query. Scoring favours title matches, then keyword/heading matches, then body
 * text. When a heading matches more specifically than the title, the result points at that anchor so
 * the reader jumps straight to the relevant section.
 */
export const searchDocs = (query: string, limit = 12): DocSearchResult[] => {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const results: DocSearchResult[] = [];
  for (const entry of INDEX) {
    let score = 0;
    let anchorId: string | undefined;
    let anchorText: string | undefined;

    for (const term of terms) {
      if (entry.title.includes(term)) score += 10;
      if (entry.keywords.includes(term)) score += 6;
      const h = entry.headings.find((hd) => hd.lc.includes(term));
      if (h) { score += 5; if (!anchorId) { anchorId = h.id; anchorText = h.text; } }
      if (entry.text.includes(term)) score += 2;
    }
    // Bonus when the full phrase appears in the title or text.
    if (terms.length > 1) {
      if (entry.title.includes(q)) score += 8;
      else if (entry.text.includes(q)) score += 3;
    }

    if (score > 0) {
      const cat = getCategory(entry.article.categoryId)!;
      results.push({
        article: entry.article,
        category: cat,
        anchorId,
        anchorText,
        snippet: makeSnippet(articleText(entry.article), terms[0]),
        score,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
};
