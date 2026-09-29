/**
 * THE 100-PAGE STUDY (GTM part 14 §1C, DO-NEXT #13) — what every stage of it shares.
 *
 * Three stages, each a script, each resumable, each writing a file the next one reads:
 *
 *   run.ts        fetch each page and run the Conversion Doctor audit on it   → study-data/results.jsonl
 *   classify.ts   file every blocker under one fixed category                 → study-data/categories.json
 *   aggregate.ts  the anonymised numbers the report page and the CSV publish  → config/research + public/research
 *
 * `study-data/` is gitignored, and has to be: it holds the URL list and the raw audits, which
 * name every company. The report names none of them (part 14 §8.1), so nothing that could
 * identify a page leaves that folder except through aggregate.ts — and scripts/study.test.ts
 * fails the build if a URL, a domain or a quoted line of page copy reaches a public file.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const STUDY_ID = 'landing-page-study-2026';
export const PRIVATE_DIR = path.join(ROOT, 'study-data');
export const URLS_CSV = path.join(PRIVATE_DIR, 'urls.csv');
export const RESULTS_JSONL = path.join(PRIVATE_DIR, 'results.jsonl');
export const CATEGORIES_JSON = path.join(PRIVATE_DIR, 'categories.json');
export const PUBLIC_SUMMARY = path.join(ROOT, 'config/research/landingPageStudy2026.json');
export const PUBLIC_CSV = path.join(ROOT, `public/research/${STUDY_ID}.csv`);

/** The audit model — the one the paid Conversion Doctor runs, not the free scorer's Flash. */
export const AUDIT_MODEL = 'gemini-2.5-pro';
/** Filing a sentence under a category is a small job; the audit itself is not. */
export const CLASSIFY_MODEL = 'gemini-2.5-flash';

/**
 * WHAT WE TELL THE SITE. The product's fetcher says "requested by a signed-in user", which
 * is true of the product and false of a study, so the study says what it is.
 */
export const STUDY_USER_AGENT =
  'MarketBrainOS-Study/1.0 (+https://www.marketbrainos.app/research/landing-page-study-2026; one-time research fetch, one request per page)';

/**
 * THE CATEGORIES ARE FIXED BEFORE THE DATA EXISTS. Letting a model invent groupings after
 * reading the blockers produces whatever headline is most quotable; a closed list written
 * first is the version where the numbers could have come out otherwise. The method section
 * of the report prints this list verbatim.
 */
export const CATEGORIES = [
  { id: 'value-prop', label: 'Unclear what it is or who it is for', hint: 'headline or opening does not say what the product does, for whom, or why it matters' },
  { id: 'cta', label: 'Weak or competing calls to action', hint: 'vague, buried, missing, or several CTAs competing for the same click' },
  { id: 'proof', label: 'Missing or thin proof', hint: 'no testimonials, customer names, numbers, case studies or evidence behind the claims' },
  { id: 'pricing', label: 'Price absent or unclear', hint: 'no price, "contact us" only, or pricing that cannot be understood' },
  { id: 'benefits', label: 'Features without outcomes', hint: 'lists what it has rather than what the visitor gets' },
  { id: 'generic', label: 'Generic or jargon-heavy copy', hint: 'could describe any competitor; buzzwords; no specifics' },
  { id: 'trust', label: 'Trust and risk gaps', hint: 'no guarantee, trial, security or company details; nothing lowers the risk of acting' },
  { id: 'objections', label: 'Objections left unanswered', hint: 'obvious questions (how it works, setup, integration, who it is not for) not addressed' },
  { id: 'friction', label: 'Friction at the next step', hint: 'forms, signup demands, too many steps, or an unclear path after the click' },
  { id: 'structure', label: 'Structure and hierarchy', hint: 'key message buried, wall of text, order that does not follow the visitor’s questions' },
  { id: 'audience', label: 'Mixed or mismatched audience', hint: 'speaks to several audiences at once, or not to the one it appears to target' },
  { id: 'other', label: 'Other', hint: 'fits none of the above' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];
export const CATEGORY_IDS: readonly string[] = CATEGORIES.map((c) => c.id);

export type Segment = 'africa' | 'global';

export interface StudyUrl {
  url: string;
  segment: Segment;
  country: string;
  sector: string;
  source: string;
  launch_date: string;
  notes: string;
}

/** One line of results.jsonl — an audit, or the honest reason there is none. */
export interface StudyResult {
  url: string;
  segment: Segment;
  country: string;
  sector: string;
  fetched_at: string;
  status: 'ok' | 'fetch_error' | 'robots_disallowed' | 'model_error';
  error?: string;
  error_kind?: string;
  final_url?: string;
  page_chars?: number;
  model?: string;
  prompt_sha?: string;
  usage?: { prompt: number; output: number; total: number };
  audit?: {
    score: number | null;
    summary: string;
    issues: { blocker: string; impact: string; severity: string }[];
    fixes: unknown[];
    rewrites: unknown[];
  };
}

/** Minimal RFC-4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes. */
export const parseCsv = (text: string): Record<string, string>[] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
};

export const toCsv = (header: string[], rows: (string | number)[][]): string => {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';
};
