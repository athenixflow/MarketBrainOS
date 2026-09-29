// Guards the 100-page study (GTM part 14 §1C, DO-NEXT #13).
//
// THE STUDY MAKES TWO PROMISES, AND BOTH ARE EASY TO BREAK WITHOUT NOTICING:
//
//   1. "We ran Conversion Doctor on these pages." True only while the study sends the
//      product's prompt. A copy of the prompt drifts the first time one is edited and not
//      the other, and then the study describes a tool nobody sells.
//   2. "No company is named." True only while nothing that identifies a page crosses from
//      study-data/ (gitignored: URLs and raw audits) to a public file. One helpful field —
//      the audit's one-line summary, a quoted headline, a hash of the URL "for dedup" — and
//      the anonymised dataset names every company in it.
//
// Every checker here is also run against a planted violation and must catch it; a guard
// that has only ever been seen passing has not been shown to guard anything.
//
// Runs in `npm run build`. `npm run test:study` runs it alone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPublic, PUBLIC_CSV_HEADER, MIN_CELL } from './study/aggregate';
import { blockerKey } from './study/classify';
import { robotsVerdict } from './study/run';
import { CATEGORIES, PUBLIC_CSV, PUBLIC_SUMMARY, StudyResult, URLS_CSV, parseCsv } from './study/shared';
import { STUDY, isStudyPublished } from '../config/research/study';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

/* Comments blanked: a file's PROSE must not satisfy a check about its CODE. */
const NEWLINE = /[^\n]/g;
const blank = (text: string) => text
  .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(NEWLINE, ' '))
  .replace(/^(\s*)\/\/.*$/gm, (c) => c.replace(NEWLINE, ' '));

/* ============================================ 1. one prompt, two callers */

console.log('THE SAME AUDIT:');

const index = blank(read('functions/src/index.ts'));
const run = blank(read('scripts/study/run.ts'));
const INLINE = 'conversion-rate-optimization (CRO) expert, audit this';

/** The product's Conversion Doctor branch, from its `else if` to the next one. */
const cdBranch = (src: string) => {
  const start = src.indexOf("module === 'ConversionDoctor_Audit'");
  const end = src.indexOf('else if (', start + 10);
  return start < 0 ? '' : src.slice(start, end < 0 ? undefined : end);
};
const usesBuilder = (branch: string) =>
  /buildConversionDoctorPrompt\(/.test(branch) && !branch.includes(INLINE);

ok(usesBuilder(cdBranch(index)), 'the product builds its Conversion Doctor prompt with the shared builder');
ok(!index.includes(INLINE), 'and no inline copy of that prompt survives anywhere in index.ts');
ok(!/const systemInstruction\s*=/.test(index) && /import \{[^}]*systemInstruction[^}]*\} from '\.\/prompts'/.test(index),
  'the product takes its system instruction from ./prompts');
ok(/from '\.\.\/\.\.\/functions\/src\/prompts'/.test(run) && /buildConversionDoctorPrompt\(/.test(run)
  && /systemInstruction/.test(run.slice(run.indexOf('getGenerativeModel'))),
  'the study sends the same builder and the same system instruction');
ok(/AUDIT_MODEL/.test(run) && /AUDIT_MODEL = 'gemini-2\.5-pro'/.test(read('scripts/study/shared.ts'))
  && /getGenerativeModel\(\{ model: "gemini-2\.5-pro", systemInstruction \}\)/.test(index),
  'and the same model the paid audit runs');
ok(/fetchPageText\(u\.url, \{ userAgent: STUDY_USER_AGENT \}\)/.test(run),
  'the study fetches with the product fetcher, under its own honest User-Agent');
ok(/robotsAllows\(u\.url\)/.test(run), 'and asks robots.txt first');

/* Robots matching, on rules copied from real sampled sites. The first version truncated a rule
   at its `*`, so `Disallow: *?lightbox=` matched every path and six readable sites were skipped. */
const g = (disallow: string[], allow: string[] = []) => [{ disallow, allow }];
ok(robotsVerdict(g(['*?lightbox='], ['/']), '/') === true, 'a wildcard rule for a query string does not block the homepage');
ok(robotsVerdict(g(['/*/pdf/', '/admin/']), '/') === true, 'a mid-path wildcard does not block the homepage');
ok(robotsVerdict(g(['/subscribe$']), '/subscribe') === false && robotsVerdict(g(['/subscribe$']), '/subscribe/x') === true,
  'a `$` rule blocks exactly that path');
ok(robotsVerdict(g(['/']), '/') === false, 'CONTROL: `Disallow: /` blocks the homepage');
ok(robotsVerdict(g(['/'], ['/pricing']), '/pricing') === true, 'the longer Allow wins over a shorter Disallow');
ok(robotsVerdict(g(['/*']), '/pricing') === false, 'CONTROL: `Disallow: /*` blocks everything');
ok(robotsVerdict(g([]), '/') === true, 'no rules means allowed');

// Negative controls: a branch that inlines the prompt again, or never calls the builder.
ok(!usesBuilder(`module === 'ConversionDoctor_Audit') { const prompt = ['As a senior ${INLINE} x']; buildConversionDoctorPrompt(`),
  'CONTROL: a branch carrying an inline copy is caught even if it also calls the builder');
ok(!usesBuilder(`module === 'ConversionDoctor_Audit') { const prompt = 'something else'; `),
  'CONTROL: a branch that stops calling the builder is caught');

/* ============================================ 2. nothing identifying goes public */

console.log('\nANONYMITY:');

/**
 * Everything that could name a page: a URL, anything shaped like a domain, a hex string long
 * enough to be a hash of one, and any listed company's own domain (read from the private list
 * when it exists, so the check tightens as soon as there is something to protect).
 */
const privateDomains = (): string[] => {
  if (!fs.existsSync(URLS_CSV)) return [];
  return parseCsv(fs.readFileSync(URLS_CSV, 'utf8'))
    .map((r) => { try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch { return ''; } })
    .filter(Boolean);
};
const OWN = /marketbrainos\.app|schema\.org/g;
const leaks = (text: string, domains: string[]): string[] => {
  const t = text.replace(OWN, '');
  const found: string[] = [];
  if (/https?:\/\//i.test(t)) found.push('a URL');
  const dom = t.match(/\b[a-z0-9-]+\.(com|io|ai|app|co|ng|ke|za|africa|net|org|dev|so|xyz|tech|me|gh|rw|eg|ly|sh)\b/i);
  if (dom) found.push(`a domain (${dom[0]})`);
  if (/\b[0-9a-f]{16,}\b/i.test(t)) found.push('a hash-length hex string');
  for (const d of domains) if (t.toLowerCase().includes(d.toLowerCase())) found.push(`a listed domain (${d})`);
  return found;
};

/** The summary may only carry these keys; a new free-text field has to be added here on purpose. */
const ALLOWED_KEYS = new Set([
  'study', 'published', 'generated_at', 'method', 'audit_model', 'classify_model', 'fetched_from', 'fetched_to',
  'listed', 'audited', 'excluded', 'total', 'unreadable', 'robots', 'model_error', 'min_cell',
  'all', 'africa', 'global', 'gap', 'groups', 'group',
  'n', 'mean', 'median', 'p25', 'p75', 'min', 'max', 'under50', 'anyCritical', 'meanIssues',
  'buckets', 'from', 'to', 'count', 'categories', 'id', 'label', 'pages', 'leading', 'num', 'den', 'pct',
]);
const strayKeys = (v: unknown, out: string[] = []): string[] => {
  if (Array.isArray(v)) v.forEach((x) => strayKeys(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
    if (!ALLOWED_KEYS.has(k)) out.push(k);
    strayKeys(x, out);
  }
  return out;
};

/* Planted data: every private field carries something identifying, so any of it reaching the
   output is visible. Seven pages in one country (a cell) and one alone (must be merged). */
const BRAND = 'Zentrovia';
const planted: StudyResult[] = [
  ...Array.from({ length: MIN_CELL + 2 }, (_, i) => ({ country: 'Nigeria', i })),
  { country: 'Rwanda', i: 99 },
  ...Array.from({ length: 6 }, (_, i) => ({ country: '', i: 200 + i, global: true })),
].map(({ country, i, global }: any) => ({
  url: `https://www.${BRAND.toLowerCase()}${i}.ng/pricing`, segment: global ? 'global' : 'africa', country,
  sector: 'fintech', fetched_at: '2026-10-01T10:00:00Z', status: 'ok', final_url: `https://${BRAND.toLowerCase()}${i}.ng/`,
  audit: {
    score: 30 + i % 60,
    summary: `${BRAND} hides its price behind "Talk to ${BRAND} sales".`,
    issues: [
      { blocker: `The ${BRAND} headline "Banking, reimagined" says nothing`, impact: 'x', severity: 'Critical' },
      { blocker: 'No price', impact: 'y', severity: 'High' },
    ],
    fixes: [{ what: `Rename ${BRAND}` }], rewrites: [{ original: `${BRAND} — Banking, reimagined`, text: 'z' }],
  },
}) as StudyResult);
planted.push({ url: `https://${BRAND.toLowerCase()}-down.ng/`, segment: 'africa', country: 'Kenya', sector: 's',
  fetched_at: '2026-10-02T10:00:00Z', status: 'fetch_error', error: `${BRAND}-down.ng refused`, error_kind: 'unreachable' });
const filings = Object.fromEntries(planted.filter((r) => r.audit).flatMap((r) =>
  r.audit!.issues.map((iss, i) => [blockerKey(r.url, i, iss.blocker), { category: i === 0 ? 'value-prop' : 'pricing', reason: `${BRAND} r`, model: 'm' }])));

const built = buildPublic(planted, planted, filings, {});
const builtJson = JSON.stringify(built.summary);
const plantedDomains = planted.map((r) => new URL(r.url).hostname.replace(/^www\./, ''));

ok(leaks(builtJson, plantedDomains).length === 0 && !builtJson.includes(BRAND),
  'the summary carries no URL, domain, hash or company name from planted audits', leaks(builtJson, plantedDomains).join(', '));
ok(leaks(built.csv, plantedDomains).length === 0 && !built.csv.includes(BRAND),
  'nor does the CSV', leaks(built.csv, plantedDomains).join(', '));
ok(!builtJson.includes('Banking, reimagined') && !built.csv.includes('Banking'),
  'no quoted page copy (blocker text, summaries, rewrites) is published');
ok(strayKeys(built.summary).length === 0, 'the summary uses only the reviewed set of keys', strayKeys(built.summary).join(', '));
ok(built.csv.split('\n')[0] === PUBLIC_CSV_HEADER.join(','), 'the CSV has exactly the reviewed columns');
ok(!built.csv.includes('Rwanda') && built.csv.includes('Other Africa') && built.csv.includes('Nigeria'),
  `a country with fewer than ${MIN_CELL} pages is merged; one with ${MIN_CELL} or more is kept`);
ok(!(built.summary.groups || []).some((g: any) => g.group === 'Rwanda'), 'and the same holds in the country table');
ok(built.summary.method.excluded.unreadable === 1 && built.summary.method.audited === planted.length - 1,
  'an unreadable page is counted as excluded, not dropped silently');
ok(built.summary.published === false, 'a fresh summary starts unpublished');
ok(buildPublic(planted, planted, filings, { published: true }).summary.published === true,
  'and re-aggregating keeps a publication decision a person already made');
{
  let threw = false;
  try { buildPublic(planted, planted, {}, {}); } catch { threw = true; }
  ok(threw, 'aggregating before every blocker is filed refuses rather than counting unfiled as "other"');
}
const cats = built.summary.all.categories;
ok(cats.find((c: any) => c.id === 'pricing')?.pages.den === built.summary.all.n
  && cats.every((c: any) => typeof c.pages.num === 'number' && 'den' in c.pages),
  'every published rate carries its numerator and denominator');
ok(CATEGORIES.some((c) => c.id === 'other') && new Set(CATEGORIES.map((c) => c.id)).size === CATEGORIES.length,
  'the fixed category list has unique ids and an "other"');

// Negative controls for the leak detectors themselves.
ok(leaks('{"x":"https://a.ng"}', []).length > 0, 'CONTROL: a URL is detected');
ok(leaks('P001,africa,acme.co.za,40', []).length > 0, 'CONTROL: a bare domain is detected');
ok(leaks('"k":"9f2c1a7be03d44aa"', []).length > 0, 'CONTROL: a URL hash is detected');
ok(leaks('Zentrovia scored 12', ['zentrovia']).length > 0, 'CONTROL: a listed company name is detected');
ok(strayKeys({ all: { summary: 'x' } }).includes('summary'), 'CONTROL: a free-text field added to the summary is caught');

/* The files actually on disk, which is what ships. */
const summaryText = fs.readFileSync(PUBLIC_SUMMARY, 'utf8');
const domains = privateDomains();
ok(leaks(summaryText, domains).length === 0, 'the committed summary JSON leaks nothing', leaks(summaryText, domains).join(', '));
ok(strayKeys(JSON.parse(summaryText)).length === 0, 'and uses only the reviewed keys', strayKeys(JSON.parse(summaryText)).join(', '));
if (fs.existsSync(PUBLIC_CSV)) {
  const csvText = fs.readFileSync(PUBLIC_CSV, 'utf8');
  ok(leaks(csvText, domains).length === 0, 'the committed CSV leaks nothing', leaks(csvText, domains).join(', '));
}
const pageSrcRaw = read('pages/LandingPageStudy.tsx');
ok(domains.every((d) => !pageSrcRaw.toLowerCase().includes(d.toLowerCase())), 'the report page names no sampled domain');
ok(/^study-data\/$/m.test(read('.gitignore')), 'study-data/ (the URL list and raw audits) is gitignored');

/* ============================================ 3. what the page says, and when */

console.log('\nPUBLICATION:');

const page = blank(pageSrcRaw);
ok(/not conversion data/.test(page), 'the page says the scores are an opinion, not conversion data');
ok(page.indexOf('not conversion data') < page.indexOf('Median score'), 'and says it before the first number');
ok(/if \(!isStudyPublished\(\)\) return <HoldingPage \/>/.test(page), 'an unpublished study renders the holding page');
ok(/HoldingPage[\s\S]*?noindex[\s\S]*?\/>/.test(page.slice(page.indexOf('const HoldingPage'))), 'which is noindex');
ok(/STUDY_PATHS\.filter\(\(\) => isStudyPublished\(\)\)/.test(blank(read('scripts/prerender.ts'))),
  'the study enters the prerender and sitemap only when published');
ok(isStudyPublished({ ...STUDY, published: true }) === false || !!STUDY.all,
  'the "published" flag alone publishes nothing without data');
ok(isStudyPublished({ study: 's', published: false, generated_at: null, all: built.summary.all as any, method: built.summary.method as any }) === false,
  'and data alone publishes nothing without the flag');
ok(!/predict|forecast|win(ning)? probability/i.test(page.replace(/not a forecast/gi, '')),
  'the page makes no prediction claim');

console.log(failures ? `\nFAIL — ${failures} check(s) failed.` : '\nPASS — the study runs the product\'s own audit, names nobody, and publishes only when a person says so.');
process.exit(failures ? 1 : 0);
