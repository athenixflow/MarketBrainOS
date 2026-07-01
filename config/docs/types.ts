// Documentation content model.
// The docs hub is content-driven: one structured registry powers the landing hub, every article
// page, the in-article table of contents, and the global search index. Each article is a list of
// typed blocks; every `heading` block becomes both a TOC entry and a scroll-spy anchor target.

export type DocBlockTone = 'info' | 'tip' | 'warning' | 'danger';

// A single renderable block. `heading` blocks carry a stable `id` used as the anchor + TOC target.
export type DocBlock =
  | { type: 'heading'; id: string; text: string }
  | { type: 'paragraph'; text: string }                              // supports **bold**, `code`, [label](path) inline
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'steps'; items: { title: string; text?: string }[] }
  | { type: 'callout'; tone?: DocBlockTone; title?: string; text: string }
  | { type: 'table'; headers: string[]; rows: string[][]; caption?: string }
  | { type: 'keyValue'; pairs: { label: string; value: string }[] }
  | { type: 'code'; text: string };

export interface DocArticle {
  id: string;              // slug within its category (URL: /documentation/:categoryId/:id)
  categoryId: string;
  title: string;
  summary: string;         // one-line description shown in the hub, sidebar tooltip, and search
  keywords?: string[];     // extra search terms not present in the visible text
  blocks: DocBlock[];
}

export interface DocCategory {
  id: string;              // URL segment (/documentation/:id)
  title: string;
  summary: string;
  icon: string;            // icon key resolved in components/docs/icons.tsx
}

// A search hit: the matched article plus the best-matching in-article section to jump to.
export interface DocSearchResult {
  article: DocArticle;
  category: DocCategory;
  anchorId?: string;       // heading id to scroll to, when a section matched more strongly than the title
  anchorText?: string;
  snippet: string;         // short context string for the result row
  score: number;
}

// The heading blocks of an article, in order — the source for the in-page table of contents.
export const articleHeadings = (article: DocArticle): { id: string; text: string }[] =>
  article.blocks.filter((b): b is Extract<DocBlock, { type: 'heading' }> => b.type === 'heading')
    .map((h) => ({ id: h.id, text: h.text }));

// Flatten an article's visible text (for the search index / snippets).
export const articleText = (article: DocArticle): string => {
  const parts: string[] = [article.title, article.summary, ...(article.keywords || [])];
  for (const b of article.blocks) {
    switch (b.type) {
      case 'heading':
      case 'paragraph':
        parts.push(b.text); break;
      case 'callout':
        parts.push(b.title || '', b.text); break;
      case 'list':
        parts.push(b.items.join(' ')); break;
      case 'steps':
        parts.push(b.items.map((i) => `${i.title} ${i.text || ''}`).join(' ')); break;
      case 'table':
        parts.push([...(b.headers || []), ...b.rows.flat()].join(' ')); break;
      case 'keyValue':
        parts.push(b.pairs.map((p) => `${p.label} ${p.value}`).join(' ')); break;
      case 'code':
        parts.push(b.text); break;
    }
  }
  return parts.join(' \n ');
};
