/**
 * Stage 1 of the study: read each page and audit it with Conversion Doctor.
 *
 *   npx tsx scripts/study/run.ts --dry-run          fetch every page, audit none (free) — do this first
 *   npx tsx scripts/study/run.ts --limit 3          a paid pilot on the first three pages
 *   npx tsx scripts/study/run.ts                    everything not yet done
 *   npx tsx scripts/study/run.ts --retry-errors     re-attempt pages that failed last time
 *
 * THE SAME AUDIT THE PRODUCT RUNS. Same fetcher (with its SSRF guard and its refusal to
 * audit a page it could not read), same prompt builder, same system instruction, same model,
 * same SDK. The one input the product has and the study does not is the audience and goal —
 * nobody told us who each page is for — so both are left out, which is the prompt's own
 * designed path for that case (the Workflow pipeline takes it too). The report says so.
 *
 * RESUMABLE AND APPEND-ONLY. Each page appends one line to results.jsonl as soon as it is
 * done, so an interrupted run loses at most the pages in flight, and a finished page is
 * never paid for twice.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fetchPageText, PageFetchError } from '../../functions/src/fetchPage';
import { buildConversionDoctorPrompt, systemInstruction } from '../../functions/src/prompts';
import {
  AUDIT_MODEL, PRIVATE_DIR, RESULTS_JSONL, STUDY_USER_AGENT, URLS_CSV, StudyResult, StudyUrl, parseCsv,
} from './shared';

/* The functions package owns the SDK; loading it from there keeps the study on the exact
   version the Cloud Function runs rather than whatever a root install would resolve. */
const require = createRequire(import.meta.url);
const { GoogleGenerativeAI } = require('../../functions/node_modules/@google/generative-ai');

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const DRY = flag('--dry-run');
const RETRY = flag('--retry-errors');
const LIMIT = opt('--limit') ? Number(opt('--limit')) : Infinity;
const CONCURRENCY = Number(opt('--concurrency') || 3);

const readApiKey = (): string => {
  if (process.env.API_KEY) return process.env.API_KEY;
  const envFile = path.resolve(PRIVATE_DIR, '../functions/.env');
  const line = fs.existsSync(envFile)
    ? fs.readFileSync(envFile, 'utf8').split(/\r?\n/).find((l) => l.startsWith('API_KEY='))
    : undefined;
  return (line?.slice('API_KEY='.length) || '').replace(/^["']|["']$/g, '').trim();
};

/**
 * ROBOTS.TXT, HONOURED. The study reads a page once, but "once" is still a request a site
 * may have asked us not to make. Only the `User-agent: *` group and our own name are read;
 * a missing or unreadable robots.txt means no rules, as the protocol says.
 */
const robotsAllows = async (pageUrl: string): Promise<boolean> => {
  const u = new URL(pageUrl);
  let body = '';
  try {
    const res = await fetch(`${u.origin}/robots.txt`, {
      headers: { 'User-Agent': STUDY_USER_AGENT }, signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return true;
    body = await res.text();
  } catch { return true; }

  const groups: { agents: string[]; disallow: string[]; allow: string[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(); const val = m[2].trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) { current = { agents: [], disallow: [], allow: [] }; groups.push(current); }
      current.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!current) continue;
      if (key === 'disallow' && val) current.disallow.push(val);
      if (key === 'allow' && val) current.allow.push(val);
    }
  }
  const ours = groups.filter((g) => g.agents.some((a) => a === 'marketbrainos-study'));
  const applicable = ours.length ? ours : groups.filter((g) => g.agents.includes('*'));
  return robotsVerdict(applicable, u.pathname + u.search);
};

/**
 * RFC 9309 matching: a rule matches from the start of the path, `*` is any run of characters
 * and a trailing `$` anchors the end. The longest matching rule wins and a tie goes to Allow.
 * Truncating a rule at its first `*` (the first version of this) turned `Disallow: *?lightbox=`
 * into a rule matching every path, and skipped six sites whose robots.txt allows `/`.
 */
export const robotsRuleMatches = (rule: string, target: string): boolean => {
  const anchored = rule.endsWith('$');
  const body = (anchored ? rule.slice(0, -1) : rule).split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`).test(target);
};

export const robotsVerdict = (groups: { disallow: string[]; allow: string[] }[], target: string): boolean => {
  const longest = (rules: string[]) => Math.max(-1, ...rules.filter((r) => robotsRuleMatches(r, target)).map((r) => r.length));
  const dis = Math.max(-1, ...groups.map((g) => longest(g.disallow)));
  const all = Math.max(-1, ...groups.map((g) => longest(g.allow)));
  return dis < 0 || all >= dis;
};

const cleanJSON = (text: string) => JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());

const main = async () => {
  if (!fs.existsSync(URLS_CSV)) throw new Error(`No URL list at ${URLS_CSV}`);
  const urls = parseCsv(fs.readFileSync(URLS_CSV, 'utf8')) as unknown as StudyUrl[];
  const bad = urls.filter((u) => !/^https?:\/\//.test(u.url) || !['africa', 'global'].includes(u.segment));
  if (bad.length) throw new Error(`Malformed rows: ${bad.map((b) => b.url || '(blank)').join(', ')}`);

  const done = new Map<string, StudyResult>();
  if (fs.existsSync(RESULTS_JSONL)) {
    for (const line of fs.readFileSync(RESULTS_JSONL, 'utf8').split('\n').filter(Boolean)) {
      const r = JSON.parse(line) as StudyResult;
      done.set(r.url, r); // later lines win, so a retry supersedes the failure it retried
    }
  }
  const pending = urls.filter((u) => {
    const prev = done.get(u.url);
    if (!prev) return true;
    return RETRY && prev.status !== 'ok' && prev.status !== 'robots_disallowed';
  }).slice(0, LIMIT);

  console.log(`${urls.length} pages listed, ${done.size} already recorded, ${pending.length} to ${DRY ? 'fetch (dry run — no model calls)' : 'audit'}.`);
  if (!pending.length) return;

  const apiKey = DRY ? '' : readApiKey();
  if (!DRY && !apiKey) throw new Error('No API_KEY in the environment or functions/.env.');
  const model = DRY ? null : new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: AUDIT_MODEL, systemInstruction });

  fs.mkdirSync(PRIVATE_DIR, { recursive: true });
  const totals = { ok: 0, failed: 0, prompt: 0, output: 0 };
  const queue = [...pending];

  const worker = async () => {
    for (let u = queue.shift(); u; u = queue.shift()) {
      const base = { url: u.url, segment: u.segment, country: u.country, sector: u.sector, fetched_at: new Date().toISOString() };
      let result: StudyResult;
      try {
        if (!(await robotsAllows(u.url))) {
          result = { ...base, status: 'robots_disallowed' };
        } else {
          const page = await fetchPageText(u.url, { userAgent: STUDY_USER_AGENT });
          if (DRY) {
            console.log(`  ok   ${page.text.length.toString().padStart(6)} chars  ${u.url}`);
            totals.ok++;
            continue; // a dry run records nothing, so the real run still audits this page
          }
          const prompt = buildConversionDoctorPrompt({ context: 'Landing Page', pageText: page.text, fetchedUrl: page.finalUrl });
          try {
            const res = await model.generateContent({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' },
            });
            const parsed = cleanJSON(res.response.text());
            const meta = res.response.usageMetadata || {};
            result = {
              ...base, status: 'ok', final_url: page.finalUrl, page_chars: page.text.length, model: AUDIT_MODEL,
              prompt_sha: crypto.createHash('sha256').update(systemInstruction + prompt).digest('hex').slice(0, 16),
              usage: { prompt: meta.promptTokenCount || 0, output: (meta.totalTokenCount || 0) - (meta.promptTokenCount || 0), total: meta.totalTokenCount || 0 },
              audit: {
                score: typeof parsed.score === 'number' ? parsed.score : null,
                summary: String(parsed.summary || ''),
                issues: Array.isArray(parsed.issues) ? parsed.issues : [],
                fixes: Array.isArray(parsed.fixes) ? parsed.fixes : [],
                rewrites: Array.isArray(parsed.rewrites) ? parsed.rewrites : [],
              },
            };
          } catch (e: any) {
            result = { ...base, status: 'model_error', final_url: page.finalUrl, error: String(e?.message || e).slice(0, 300) };
          }
        }
      } catch (e: any) {
        if (e instanceof PageFetchError) result = { ...base, status: 'fetch_error', error: e.message, error_kind: e.kind };
        else result = { ...base, status: 'fetch_error', error: String(e?.message || e).slice(0, 300), error_kind: 'unexpected' };
      }

      if (DRY) {
        console.log(`  FAIL ${result.status}${result.error ? ` — ${result.error}` : ''}  ${u.url}`);
        totals.failed++;
        continue;
      }
      fs.appendFileSync(RESULTS_JSONL, JSON.stringify(result) + '\n');
      if (result.status === 'ok') {
        totals.ok++; totals.prompt += result.usage!.prompt; totals.output += result.usage!.output;
        console.log(`  ok   score ${String(result.audit!.score).padStart(3)}  ${u.segment.padEnd(6)}  ${u.url}`);
      } else {
        totals.failed++;
        console.log(`  FAIL ${result.status}${result.error ? ` — ${result.error}` : ''}  ${u.url}`);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));

  console.log(`\n${totals.ok} ok, ${totals.failed} failed.`);
  if (!DRY) {
    /* Token counts are exact (from the API); the dollar figure is an estimate at the
       published gemini-2.5-pro list price and is labelled as one. Output includes thinking. */
    const usd = (totals.prompt / 1e6) * 1.25 + (totals.output / 1e6) * 10;
    console.log(`Tokens this run: ${totals.prompt} in, ${totals.output} out (≈ $${usd.toFixed(2)} at list price).`);
  }
};

/* Imported by scripts/study.test.ts for the robots matcher, so only run when invoked directly. */
if (process.argv[1] && /run\.ts$/.test(process.argv[1])) {
  main().catch((e) => { console.error(e?.message || e); process.exit(1); });
}
