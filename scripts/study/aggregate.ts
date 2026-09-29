/**
 * Stage 3 of the study: the numbers the report publishes, and nothing that names a page.
 *
 *   npx tsx scripts/study/aggregate.ts
 *
 * Writes config/research/landingPageStudy2026.json (read by the report page) and
 * public/research/landing-page-study-2026.csv (the anonymised per-page data).
 *
 * WHAT CROSSES FROM PRIVATE TO PUBLIC, EXHAUSTIVELY: a segment, a country group, a score,
 * issue and severity counts, and category ids. No URL, no domain, no hash of either (a hash
 * of a URL is reversible by anyone with a candidate list), no summary, no blocker text, no
 * rewrite — every free-text field an audit produces can quote the page, and a quote is a
 * name. Rows are ordered by score, not by list position, so the order leaks nothing either.
 *
 * SMALL CELLS ARE MERGED. A country with fewer than MIN_CELL audited pages is reported as
 * "Other Africa": "the one Rwandan healthtech scored 31" identifies a company as surely as
 * its URL would.
 *
 * `published` IS NEVER SET HERE. Re-running keeps whatever the file already says, and a new
 * file starts unpublished; publishing is a human decision after reading the result.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  AUDIT_MODEL, CATEGORIES, CATEGORIES_JSON, CLASSIFY_MODEL, PUBLIC_CSV, PUBLIC_SUMMARY, STUDY_ID, URLS_CSV,
  StudyResult, parseCsv, toCsv,
} from './shared';
import { Filing, blockerKey, latestResults } from './classify';

export const MIN_CELL = 5;

const quantile = (sorted: number[], q: number): number | null => {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos); const hi = Math.ceil(pos);
  return Math.round((sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)) * 10) / 10;
};
const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
/** Every rate carries what it is a rate OF; a percentage over an empty set is null, not 0. */
const rate = (num: number, den: number) => ({ num, den, pct: den ? Math.round((num / den) * 1000) / 10 : null });

interface Page { segment: string; country: string; score: number; issues: number; critical: number; high: number; cats: string[] }

const summarise = (pages: Page[]) => {
  const scores = pages.map((p) => p.score).sort((a, b) => a - b);
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    from: i * 10, to: i === 9 ? 100 : i * 10 + 9,
    count: scores.filter((s) => (i === 9 ? s >= 90 : s >= i * 10 && s < i * 10 + 10)).length,
  }));
  const categories = CATEGORIES.map((c) => ({
    id: c.id, label: c.label,
    /* "share of pages with at least one blocker of this kind" — a page with three pricing
       complaints is one page with a pricing problem, not three. */
    pages: rate(pages.filter((p) => p.cats.includes(c.id)).length, pages.length),
    leading: rate(pages.filter((p) => p.cats[0] === c.id).length, pages.length),
  })).sort((a, b) => b.pages.num - a.pages.num);
  return {
    n: pages.length,
    mean: mean(scores), median: quantile(scores, 0.5), p25: quantile(scores, 0.25), p75: quantile(scores, 0.75),
    min: scores[0] ?? null, max: scores[scores.length - 1] ?? null,
    under50: rate(scores.filter((s) => s < 50).length, scores.length),
    anyCritical: rate(pages.filter((p) => p.critical > 0).length, pages.length),
    meanIssues: mean(pages.map((p) => p.issues)),
    buckets, categories,
  };
};

export const PUBLIC_CSV_HEADER = ['id', 'segment', 'country_group', 'score', 'issues', 'critical', 'high', 'category_1', 'category_2', 'category_3'];

/** Pure: private inputs in, publishable outputs out. scripts/study.test.ts runs it on planted data. */
export const buildPublic = (
  listed: unknown[], results: StudyResult[], filings: Record<string, Filing>, previous: { published?: boolean },
) => {
  const ok = results.filter((r) => r.status === 'ok' && typeof r.audit?.score === 'number');
  let unfiled = 0;
  const pages: Page[] = ok.map((r) => {
    const cats = r.audit!.issues.map((iss, i) => {
      const f = filings[blockerKey(r.url, i, String(iss.blocker || ''))];
      if (!f) unfiled++;
      return f?.category ?? 'other';
    });
    const sev = (s: string) => r.audit!.issues.filter((i) => String(i.severity).toLowerCase() === s).length;
    return {
      segment: r.segment, country: r.country || '', score: Math.max(0, Math.min(100, Math.round(r.audit!.score!))),
      issues: r.audit!.issues.length, critical: sev('critical'), high: sev('high'), cats,
    };
  });
  if (unfiled) throw new Error(`${unfiled} blockers are not filed yet — run classify.ts first, or the category counts are wrong.`);

  /* Country groups are decided on the AUDITED set, since that is what the cell sizes are. */
  const africaCounts = new Map<string, number>();
  pages.filter((p) => p.segment === 'africa').forEach((p) => africaCounts.set(p.country, (africaCounts.get(p.country) || 0) + 1));
  const groupOf = (p: Page) => p.segment === 'global' ? 'Global'
    : (africaCounts.get(p.country) || 0) >= MIN_CELL && p.country ? p.country : 'Other Africa';

  const excluded = results.filter((r) => r.status !== 'ok' || typeof r.audit?.score !== 'number');
  const byStatus = (s: string) => excluded.filter((r) => r.status === s).length;
  const dates = results.map((r) => r.fetched_at).sort();

  const all = summarise(pages);
  const africa = summarise(pages.filter((p) => p.segment === 'africa'));
  const global = summarise(pages.filter((p) => p.segment === 'global'));
  const groups = [...new Set(pages.map(groupOf))].map((g) => {
    const s = summarise(pages.filter((p) => groupOf(p) === g));
    return { group: g, n: s.n, median: s.median, mean: s.mean };
  }).sort((a, b) => b.n - a.n);

  const summary = {
    study: STUDY_ID,
    published: previous.published === true,
    generated_at: new Date().toISOString(),
    method: {
      audit_model: AUDIT_MODEL,
      classify_model: CLASSIFY_MODEL,
      fetched_from: dates[0]?.slice(0, 10) ?? null,
      fetched_to: dates[dates.length - 1]?.slice(0, 10) ?? null,
      listed: listed.length,
      audited: pages.length,
      excluded: {
        total: excluded.length,
        unreadable: byStatus('fetch_error'),
        robots: byStatus('robots_disallowed'),
        model_error: byStatus('model_error') + excluded.filter((r) => r.status === 'ok').length,
      },
      min_cell: MIN_CELL,
    },
    all, africa, global,
    gap: {
      mean: africa.mean != null && global.mean != null ? Math.round((africa.mean - global.mean) * 10) / 10 : null,
      median: africa.median != null && global.median != null ? Math.round((africa.median - global.median) * 10) / 10 : null,
    },
    groups,
  };

  const rows = [...pages].sort((a, b) => a.score - b.score || a.segment.localeCompare(b.segment))
    .map((p, i) => [`P${String(i + 1).padStart(3, '0')}`, p.segment, groupOf(p), p.score, p.issues, p.critical, p.high,
      p.cats[0] || '', p.cats[1] || '', p.cats[2] || '']);
  return { summary, csv: toCsv(PUBLIC_CSV_HEADER, rows), excluded: excluded.length };
};

const main = () => {
  const listed = parseCsv(fs.readFileSync(URLS_CSV, 'utf8'));
  const filings: Record<string, Filing> = fs.existsSync(CATEGORIES_JSON) ? JSON.parse(fs.readFileSync(CATEGORIES_JSON, 'utf8')) : {};
  const previous = fs.existsSync(PUBLIC_SUMMARY) ? JSON.parse(fs.readFileSync(PUBLIC_SUMMARY, 'utf8')) : {};
  const { summary, csv, excluded } = buildPublic(listed, latestResults(), filings, previous);
  const { all, africa, global } = summary;

  fs.mkdirSync(path.dirname(PUBLIC_SUMMARY), { recursive: true });
  fs.writeFileSync(PUBLIC_SUMMARY, JSON.stringify(summary, null, 2) + '\n');
  fs.mkdirSync(path.dirname(PUBLIC_CSV), { recursive: true });
  fs.writeFileSync(PUBLIC_CSV, csv);

  console.log(`${all.n} audited (${africa.n} africa, ${global.n} global), ${excluded} excluded.`);
  console.log(`Median ${all.median}; africa ${africa.median} vs global ${global.median}.`);
  console.log(`Top categories: ${all.categories.slice(0, 5).map((c) => `${c.id} ${c.pages.pct}%`).join(', ')}`);
  console.log(`published: ${summary.published} (set by hand in ${path.relative(process.cwd(), PUBLIC_SUMMARY)} after review)`);
};

if (process.argv[1] && /aggregate\.ts$/.test(process.argv[1])) main();
