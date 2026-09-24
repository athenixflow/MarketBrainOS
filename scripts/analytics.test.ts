// Guards the analytics instrumentation (GTM part 03 §7, DO-NOW #3).
//
// TWO THINGS ARE BEING PROTECTED, and they pull in opposite directions.
//
// THE PROMISE: the consent banner tells visitors that nothing is collected until they
// accept. `track()` is now called from a dozen places, and any one of them could send an
// event before a choice exists — the failure would be invisible in the UI, visible only in
// a network tab nobody opens, and it would make the privacy policy a false statement.
//
// THE MEASUREMENT: the go-to-market plan gates real money on activation, W4 retention and
// free→paid. Those are computed from server counters, and a quiet regression — a stopped
// run counted as a completion, a cohort key that changes weekly — produces a confident
// number that is wrong, which is worse than no number at all.
//
// Runs in `npm run build`. `npm run test:analytics` runs it alone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

/**
 * Comments blanked rather than stripped, so line numbers stay put.
 *
 * ITS FIRST RUN REPORTED ITS OWN EXPLANATION AS THE BUG: the wrapper's comment saying
 * "nothing is queued for later" matched the check looking for a queue. What a file DOES
 * is its code; what it says about itself is not evidence either way.
 */
const code = (rel: string) => read(rel)
  .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  .replace(/^(\s*)\/\/.*$/gm, (c) => c.replace(/[^\n]/g, ' '));

let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

/* ============================================ 1. the consent gate, in the wrapper */

console.log('CONSENT GATE:');
const analytics = read('services/analytics.ts');

ok(/readStoredConsent\(\)\s*!==\s*CONSENT_ANALYTICS_YES\)\s*return\s*'no_consent'/.test(analytics),
  'track() refuses to send unless consent is an explicit yes');

/*
 * NOTHING IS QUEUED. A buffer flushed on Accept would send the browsing somebody did
 * BEFORE agreeing — the exact thing the banner exists to prevent, arriving later and
 * looking like a feature. The absence of a queue is the guarantee, so it is asserted.
 */
ok(!/\bqueue\b|\bpending\s*(?:Events|Queue)\b|flush\(/i.test(code('services/analytics.ts')),
  'no event queue exists to replay pre-consent activity after Accept');

/* The reserved-name cast must not become a blanket `any`, which would let a typo for an
   event name through and produce a GA4 property full of events nobody defined. */
ok(!/as\s+any\s*,\s*clean\(/.test(analytics),
  'the SDK cast is narrow (Parameters<…>), not `as any`');

/* ============================================ 2. every call site goes through it */

console.log('\nCALL SITES:');
const appFiles = ['components', 'pages', 'services', 'context']
  .flatMap((dir) => {
    const walk = (d: string, out: string[] = []): string[] => {
      const abs = path.join(root, d);
      if (!fs.existsSync(abs)) return out;
      for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
        const rel = path.join(d, e.name);
        if (e.isDirectory()) walk(rel, out);
        else if (/\.tsx?$/.test(e.name)) out.push(rel);
      }
      return out;
    };
    return walk(dir);
  });

/*
 * NOBODY CALLS gtag OR logEvent DIRECTLY. One wrapper is what makes the consent gate a
 * gate rather than a habit: a second path to GA4 would be a second place to forget it.
 * `services/analytics.ts` and `services/firebase.ts` are the two files allowed to name
 * the SDK — the wrapper itself, and the consent switch it reads.
 */
const directSenders = appFiles.filter((f) => {
  if (f.endsWith(`analytics.ts`) || f.endsWith(`firebase.ts`)) return false;
  return /\bgtag\s*\(|firebaseLogEvent\s*\(|from\s+'firebase\/analytics'/.test(code(f));
});
ok(directSenders.length === 0,
  'no screen reaches GA4 except through track()', directSenders.join(', '));

/* The funnel the plan's gates are defined over must actually be instrumented; a gate with
   no event behind it reads as a flat zero and gets blamed on the market. */
const allApp = appFiles.map(read).join('\n');
/*
 * DERIVED FROM THE UNION, not a list kept by hand. A hand-kept list only ever checks the
 * events somebody remembered to add to it, so a name declared in `AnalyticsEvent` and sent
 * by nothing - the dead-event shape - passes it silently. Reading the union means adding a
 * name to the type is itself the promise this checks.
 */
/* Comments are stripped BEFORE the split on `;`, because a comment inside the union can
   contain one - and the first cut of this check stopped at exactly that semicolon,
   testing 8 of the names and saying nothing about the rest. */
const unionBlock = read('services/analytics.ts').split('export type AnalyticsEvent =')[1]!
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')
  .split(';')[0]!;
const declared = [...unionBlock.matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]!);
ok(declared.length >= 11, `the event union was parsed (${declared.length} names)`);
for (const event of declared) {
  ok(new RegExp(`track\\(\\s*'${event}'`).test(allApp), `${event} is fired somewhere`);
}

/* ============================ 3. activation counts what the plan says it counts */

console.log('\nACTIVATION (server):');
const server = read('functions/src/index.ts');

ok(/const ACTIVATION_RUNS = 2;/.test(server) && /ACTIVATION_WINDOW_MS = 7 \* 24/.test(server),
  'activation is two runs inside seven days (part 03 §6.2), named not inlined');

/*
 * IT IS STAMPED ONCE. `activated_at` defines cohort membership for every retention figure
 * in the plan; a field that can be rewritten later silently moves users between cohorts
 * and makes last month's retention change when you look at it again.
 */
ok(/if \(!data\.activated_at && count >= ACTIVATION_RUNS\)/.test(server),
  'activated_at is only ever set when absent — never re-stamped');

/*
 * COUNTED FROM THE SERVER, BESIDE THE PROOF. The counter increment must sit in the same
 * success path as the `status: 'success'` action_logs row; anywhere else and the two
 * sources the dashboard reconciles could disagree about the same run.
 */
const successBlock = server.slice(
  server.indexOf("status: 'success',"),
  server.indexOf("res.status(200).json({ result: finalOutput"),
);
ok(/analyses_count: count/.test(successBlock),
  'the growth counters are written in the success path, next to the action_logs row');

/* Measurement may never cost somebody their analysis: the counter write is caught. */
ok(/catch \(growthErr: any\)/.test(server),
  'a failed counter write is logged, never thrown at the user');

/* ================================ 4. the wall is recorded */

console.log('\nTOKEN WALL:');
ok(/error_code: wallCode/.test(server) && /'INSUFFICIENT_TOKENS'/.test(server),
  'the 429 writes an action_logs row naming which limit was hit');
ok(/BUDGET_EXHAUSTED/.test(server) && /MEMBER_BUDGET_EXHAUSTED/.test(server),
  'a personal balance, a workspace budget and a member budget are told apart');

/* ================================ 5. the rollup reports honestly */

console.log('\nGROWTH ROLLUP:');
ok(/growth_daily/.test(server) && /schedule\('30 0 \* \* \*'\)/.test(server),
  'growth_daily runs nightly, after the day it reports on has closed');

/*
 * A RATE WITH NO DENOMINATOR IS NULL, NOT ZERO. "0% activation" on a day nobody signed up
 * is a false alarm that teaches the reader to ignore the dashboard — the same rule the
 * launch-readiness metrics already follow ("an unmeasured thing is not a measured zero").
 */
ok(/const ratio = \(n: number, d: number\) => \(d > 0 \? [^:]+ : null\)/.test(server),
  'rates are null over an empty denominator, never 0');

/* Every rate is written beside the two counts it came from. */
for (const [rate, num, den] of [
  ['activation_rate', 'activation_activated', 'activation_cohort'],
  ['w4_rate', 'w4_retained', 'w4_cohort'],
]) {
  ok(new RegExp(`${num}:`).test(server) && new RegExp(`${den}:`).test(server)
    && new RegExp(`${rate}:`).test(server),
  `${rate} ships with its numerator and denominator`);
}

/*
 * ACTIVATION IS MEASURED ON A CLOSED COHORT. A cohort still inside its seven-day window
 * has not finished activating; counting it would drag the headline rate down every single
 * day and make a healthy product look like a failing one.
 */
ok(/const cohortEnd = new Date\(end\.getTime\(\) - ACTIVATION_WINDOW_MS\);/.test(server),
  'the activation cohort is one whose window has already closed');

/* ================================ 6. attribution and cohort keys */

console.log('\nATTRIBUTION:');
ok(/persistAttribution[\s\S]{0,400}readStoredConsent\(\) !== CONSENT_ANALYTICS_YES\) return;/.test(analytics),
  'the marketing source is only written to storage with consent');

const persistence = read('services/persistenceService.ts');
ok(/\.\.\.readAttribution\(\),/.test(persistence) && /cohort_week: cohortWeek\(\)/.test(persistence),
  'signup_source and cohort_week are stamped when the profile is created');

/*
 * FIRST-TOUCH IS IMMUTABLE. `firestore.rules` keeps the growth fields off the client
 * update allowlist, so the channel that produced a signup cannot be rewritten afterwards
 * — by a later visit, or by anybody curious about the dashboard.
 */
const rules = read('firestore.rules');
const updateAllowlist = rules.slice(rules.indexOf('allow update: if self(uid)'), rules.indexOf('allow delete: if false'));
for (const field of ['signup_source', 'cohort_week', 'analyses_count', 'activated_at']) {
  ok(!updateAllowlist.includes(field), `${field} is not client-writable after creation`);
}

console.log(failures === 0
  ? '\nPASS — consent holds, the funnel is instrumented, and the gates are measurable.'
  : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
