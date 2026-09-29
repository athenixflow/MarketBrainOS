/**
 * Stage 2 of the study: file every blocker the audits found under one fixed category.
 *
 *   npx tsx scripts/study/classify.ts
 *
 * WHY A SECOND PASS AT ALL. "The five most-flagged blockers" is the headline of the report,
 * and the audits describe blockers in free text — "no pricing shown", "pricing hidden behind
 * a demo", "the cost is never stated" are one finding said three ways. Counting strings
 * would undercount it; counting by eye would count whatever the reader expected to find.
 *
 * WHY IT CANNOT MOVE THE RESULT. The categories are the closed list in shared.ts, written
 * before any page was audited. The model picks one id per blocker from that list and gives
 * a reason; an id outside it is recorded as `other`, not accepted. Every assignment is
 * saved with its reason, so anyone doubting a count can read the sentences behind it.
 *
 * Resumable: a blocker already filed (keyed by page + position + text) is not sent again.
 */

import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  CATEGORIES, CATEGORY_IDS, CATEGORIES_JSON, CLASSIFY_MODEL, PRIVATE_DIR, RESULTS_JSONL, StudyResult,
} from './shared';

/* The functions package owns the SDK; loading it from there keeps the study on the exact
   version the Cloud Function runs. LOADED ON CALL, NEVER ON IMPORT: Vercel installs only the root
   package, and scripts/study.test.ts imports this file during the build — a top-level require
   of functions/node_modules failed the 2026-09-29 deploy. scripts/deploy.test.mjs guards it. */
const require = createRequire(import.meta.url);
const loadSdk = () => require('../../functions/node_modules/@google/generative-ai');

export interface Filing { category: string; reason: string; model: string }

export const blockerKey = (url: string, index: number, blocker: string) =>
  crypto.createHash('sha256').update(`${url}\n${index}\n${blocker}`).digest('hex').slice(0, 20);

const readApiKey = (): string => {
  if (process.env.API_KEY) return process.env.API_KEY;
  const envFile = path.resolve(PRIVATE_DIR, '../functions/.env');
  const line = fs.existsSync(envFile)
    ? fs.readFileSync(envFile, 'utf8').split(/\r?\n/).find((l) => l.startsWith('API_KEY='))
    : undefined;
  return (line?.slice('API_KEY='.length) || '').replace(/^["']|["']$/g, '').trim();
};

/** The latest line per URL, so a retried page counts once, as its retry. */
export const latestResults = (): StudyResult[] => {
  const byUrl = new Map<string, StudyResult>();
  for (const line of fs.readFileSync(RESULTS_JSONL, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(line) as StudyResult;
    byUrl.set(r.url, r);
  }
  return [...byUrl.values()];
};

const main = async () => {
  const filings: Record<string, Filing> = fs.existsSync(CATEGORIES_JSON)
    ? JSON.parse(fs.readFileSync(CATEGORIES_JSON, 'utf8')) : {};

  const todo: { key: string; blocker: string; impact: string }[] = [];
  for (const r of latestResults().filter((x) => x.status === 'ok')) {
    r.audit!.issues.forEach((iss, i) => {
      const key = blockerKey(r.url, i, String(iss.blocker || ''));
      if (!filings[key]) todo.push({ key, blocker: String(iss.blocker || ''), impact: String(iss.impact || '') });
    });
  }
  console.log(`${Object.keys(filings).length} blockers already filed, ${todo.length} to file.`);
  if (!todo.length) return;

  const model = new (loadSdk().GoogleGenerativeAI)(readApiKey()).getGenerativeModel({ model: CLASSIFY_MODEL });
  const list = CATEGORIES.map((c) => `- ${c.id}: ${c.label} (${c.hint})`).join('\n');

  for (let i = 0; i < todo.length; i += 25) {
    const batch = todo.slice(i, i + 25);
    const prompt = [
      'File each landing-page conversion blocker below under exactly ONE category from this fixed list.',
      'Use only these ids. If none fits, use "other" — do not invent a category.',
      list,
      'Pick the category that names the blocker\'s main problem, not a side effect of it.',
      'Blockers:',
      ...batch.map((b, j) => `${j}. ${b.blocker} — ${b.impact}`),
      'Return strict JSON: { "filings": [{ "n": <number above>, "category": "<id>", "reason": "<one short clause>" }] }, one entry per blocker, in order.',
    ].join('\n');
    const res = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    });
    /* A malformed reply loses this batch, not the run: it stays unfiled, a rerun retries it, and
       aggregate.ts refuses to count while anything is unfiled. */
    let parsed: any;
    try { parsed = JSON.parse(res.response.text()); } catch (e: any) {
      console.log(`  batch at ${i} came back malformed (${String(e?.message || e).slice(0, 60)}) — rerun to retry`);
      continue;
    }
    for (const f of Array.isArray(parsed.filings) ? parsed.filings : []) {
      const b = batch[Number(f.n)];
      if (!b) continue;
      const category = CATEGORY_IDS.includes(f.category) ? f.category : 'other';
      filings[b.key] = { category, reason: String(f.reason || '').slice(0, 200), model: CLASSIFY_MODEL };
    }
    fs.writeFileSync(CATEGORIES_JSON, JSON.stringify(filings, null, 1));
    const missing = batch.filter((b) => !filings[b.key]).length;
    console.log(`  filed ${batch.length - missing}/${batch.length}${missing ? ` — ${missing} unanswered, rerun to retry` : ''}`);
  }
};

/* Imported by aggregate.ts for latestResults/blockerKey, so only run when invoked directly. */
if (process.argv[1] && /classify\.ts$/.test(process.argv[1])) {
  main().catch((e) => { console.error(e?.message || e); process.exit(1); });
}
