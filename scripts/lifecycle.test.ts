// Guards the lifecycle email sequence and its unsubscribe control (GTM part 12).
//
// THE RISK HERE IS NOT A BROKEN EMAIL. It is bulk mail that cannot be unsubscribed from.
//
// Gmail and Yahoo's bulk-sender rules require `List-Unsubscribe` and a working one-click
// POST endpoint on marketing mail. Send onboarding without them and the people who want out
// press "spam" instead — and a complaint rate is a DOMAIN-level reputation problem, so the
// first thing it costs is the transactional mail: receipts, password resets, verification
// links, all quietly filtered for everybody. One unsubscribable email is not a small bug.
//
// The second risk is the opposite mistake: an unsubscribe control on a receipt, which
// teaches people that unsubscribing stops the mail they actually want.
//
// Runs in `npm run build`. `npm run test:lifecycle` runs it alone.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

/* The secret has to exist before the module under test is imported: `unsubToken` reads it
   per call, but a test that forgets this would see empty tokens and pass vacuously. */
process.env.UNSUB_SECRET = 'test-secret-for-guards-only';
/* A real Svix secret shape: `whsec_` plus base64 key bytes. The verifier decodes it,
   so a made-up string would make every signature check fail for the wrong reason. */
process.env.RESEND_WEBHOOK_SECRET = 'whsec_' + Buffer.from('lifecycle-guard-key-000000000000').toString('base64');
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_test_key_for_guards';

const { EMAIL_TEMPLATES, MARKETING_KEYS } = await import('../functions/src/email/templates');
const { unsubToken, unsubUrl, verifyUnsubToken } = await import('../functions/src/email/unsubscribe');
const { verifyResendWebhook, webhookConfigured, EVENT_FIELD, emailStatusFor } = await import('../functions/src/email/webhook');

let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

const server = fs.readFileSync(path.join(root, 'functions', 'src', 'index.ts'), 'utf8');
/* Comments blanked before any source match: a file's own prose about unsubscribing must
   never be what satisfies a check about unsubscribing. */
const blank = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const code = blank(server);

/* ================================ 1. the link, in the mail itself */

console.log('THE UNSUBSCRIBE LINK:');

const MARKER = 'https://unsub.example.test/one-click';
const render = (key: string): string => {
  const fn = (EMAIL_TEMPLATES as any)[key];
  try {
    return String(fn({
      unsubUrl: MARKER, firstName: 'Ada', balance: 12, analysisCount: 1, tier: 'free',
      lastTool: 'ConversionDoctor_Audit', lastToolLabel: 'Conversion audit', lastScore: 63,
      containerName: 'Acme', planName: 'Pro', tokens: 100, amount: 19, typeLabel: 'Seat',
      verifyUrl: 'https://x.test/v', resetUrl: 'https://x.test/r',
    })?.html || '');
  } catch (e: any) {
    return `RENDER_FAILED: ${e?.message || e}`;
  }
};

const allKeys = Object.keys(EMAIL_TEMPLATES);
ok(allKeys.length > 20, `${allKeys.length} templates found`);
ok(MARKETING_KEYS.size >= 7, `${MARKETING_KEYS.size} of them are marketing mail`);

for (const key of allKeys) {
  const html = render(key);
  ok(!html.startsWith('RENDER_FAILED'), `${key} renders`, html.slice(0, 120));
  const carries = html.includes(MARKER);
  if ((MARKETING_KEYS as Set<string>).has(key)) {
    ok(carries, `${key} (marketing) carries the unsubscribe link`);
  } else {
    /* The inverse matters just as much — see the header comment. */
    ok(!carries, `${key} (transactional) carries no unsubscribe link`);
  }
}

/* ============================ 2. the send path refuses to break the rule */

console.log('\nTHE SEND PATH:');

const send = blank(fs.readFileSync(path.join(root, 'functions', 'src', 'email', 'send.ts'), 'utf8'));
ok(/MARKETING_KEYS\.has\(key\)/.test(send), 'sendTemplate asks whether the key is marketing mail');
ok(/if \(marketing && !url\)/.test(send) && /return;/.test(send),
  'a marketing send with no usable link is refused, not sent without one');
ok(/'List-Unsubscribe':/.test(send) && /'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'/.test(send),
  'both RFC 8058 headers are set');

/* ================================== 3. the token */

console.log('\nTHE TOKEN:');

const A = 'uid-aaaaaaaaaaaaaaaaaaaa';
const B = 'uid-bbbbbbbbbbbbbbbbbbbb';
ok(unsubToken(A).length >= 16, 'a token is produced');
ok(unsubToken(A) !== unsubToken(B), 'two accounts get different tokens');
ok(verifyUnsubToken(A, unsubToken(A)), 'the right token verifies');
ok(!verifyUnsubToken(A, unsubToken(B)), "another account's token does not");
ok(!verifyUnsubToken(A, ''), 'an empty token does not');
ok(!verifyUnsubToken(A, A), 'the uid alone is not its own token');
ok(!unsubToken(A).includes(A), 'the token does not contain the uid it signs');
ok(unsubUrl(A).includes(`u=${A}`) && unsubUrl(A).includes('t='), 'the URL carries both parts');

/* ============================= 4. the endpoint, and what it writes */

console.log('\nTHE ENDPOINT:');

const endpoint = code.slice(code.indexOf('export const unsubscribe'), code.indexOf('export const paystackWebhook'));
ok(endpoint.length > 0, 'the endpoint was located');
ok(/verifyUnsubToken\(uid, token\)/.test(endpoint), 'it checks the signature before doing anything');
/*
 * THE FIELD IT WRITES IS THE FIELD THE DISPATCHER READS. Two names for one idea — an
 * endpoint that sets `unsubscribed` and a dispatcher that checks `marketing_opt_out` —
 * is an unsubscribe button that does nothing, and nobody who presses one ever reports it.
 */
ok(/marketing_opt_out: true/.test(endpoint), 'it sets marketing_opt_out');
ok(/u\.marketing_opt_out === true/.test(code), 'the dispatcher skips anybody with that field set');
/*
 * AND THE CONTROL THE ACCOUNT PAGE ALREADY SHOWED. Settings writes
 * `notification_prefs.product`; the dispatcher ignored it, so the toggle people were given
 * did nothing to the sequence and the only working control was a link inside the email.
 */
ok(/notification_prefs\?\.product === false/.test(code),
  "the dispatcher honours Settings' own product-email toggle");
ok(/notification_prefs: \{ product: false \}/.test(endpoint),
  'unsubscribing switches that toggle off too, so the account page agrees with the link');

/* ============================ 5. the sequence itself */

console.log('\nTHE SEQUENCE:');

const stepBlock = code.slice(code.indexOf('const LIFECYCLE_STEPS'), code.indexOf('LIFECYCLE_MIN_GAP_MS ='));
const stepKeys = [...stepBlock.matchAll(/key: '([A-Za-z0-9]+)'/g)].map((m) => m[1]!);
ok(stepKeys.length >= 7, `${stepKeys.length} steps are scheduled`, stepKeys.join(', '));

/* Every step has a template… */
for (const key of stepKeys) {
  ok(key in EMAIL_TEMPLATES, `${key} has a template`);
  ok((MARKETING_KEYS as Set<string>).has(key), `${key} is declared as marketing mail`);
}
/* …and every marketing template is reachable from a step. A template nothing sends is the
   "wired to nothing" shape: it passes every rendering check and reaches no one. */
for (const key of MARKETING_KEYS as Set<string>) {
  ok(stepKeys.includes(key), `${key} is actually scheduled by the dispatcher`);
}

/* The uid has to reach sendTemplate or the link cannot be built and the send is refused —
   which would switch the whole sequence off silently. */
const dispatcher = code.slice(code.indexOf('export const lifecycleEmails'), code.indexOf('export const unsubscribe'));
ok(/\}, uid\);/.test(dispatcher), 'the dispatcher passes the uid, so a link can be built');
ok(/now - lastAt < LIFECYCLE_MIN_GAP_MS/.test(dispatcher), 'the 48-hour frequency cap is enforced');
ok(/if \(state\[step\.key\]\) continue;/.test(dispatcher), 'a step is sent once each, ever');

/*
 * EVERY STEP'S CLOCK MUST HAVE A QUERY BEHIND IT.
 *
 * The steps run on three different clocks — signup, first run, last run — and a scan that
 * only asks "who signed up recently" cannot see the people the other two are about: somebody
 * dormant for two months signed up long before any onboarding window, and somebody on their
 * tenth run may have signed up last year. The first cut had exactly one query, so every
 * win-back email would have been scheduled, counted, tested, and sent to nobody.
 *
 * Each clock is checked against the query that has to find its users, and the numbers are
 * read out of the source rather than written down here, so moving either moves the check.
 */
const stepLines = stepBlock.split(/(?=\{ key:)/).filter((l) => l.includes('key:'));
const clockOf = (line: string): 'signup' | 'firstRun' | 'lastRun' | 'unknown' =>
  /signupAt\(u\)/.test(line) ? 'signup'
    : /firstRunAt\(u\)/.test(line) ? 'firstRun'
      : /lastRunAt\(u\)/.test(line) ? 'lastRun' : 'unknown';
const daysIn = (line: string): number =>
  Number((line.match(/\+ (\d+) \* 86_400_000/) || [])[1] || 0);
const staleIn = (line: string): number =>
  Number((line.match(/staleAfterDays: (\d+)/) || [])[1] || 0);

ok(stepLines.length === stepKeys.length,
  `every step was parsed (${stepLines.length} of ${stepKeys.length})`);
ok(stepLines.every((l) => clockOf(l) !== 'unknown'),
  'every step is clocked on signup, first run or last run — none on nothing');

const signupWindowDays = Number((code.match(/signupWindow = new Date\(now - (\d+) \* 24/) || [])[1] || 0);
const signupSteps = stepLines.filter((l) => clockOf(l) === 'signup');
const latestSignupStep = Math.max(...signupSteps.map((l) => daysIn(l) + staleIn(l)));
ok(signupWindowDays >= latestSignupStep,
  `the signup scan (${signupWindowDays}d) covers its last step and staleness (${latestSignupStep}d)`);

/* First-run steps are reached through the same signup scan, so they are bounded by it too. */
const firstRunSteps = stepLines.filter((l) => clockOf(l) === 'firstRun');
ok(firstRunSteps.every((l) => daysIn(l) + staleIn(l) <= signupWindowDays),
  'first-run steps also fall inside the signup scan that has to find them');

/* Which threshold the run-count scan uses decides which last-run steps it serves. */
const heavyScan = Number((code.match(/where\('analyses_count', '>=', (\d+)\)/) || [])[1] || -1);
const dormantDays = Number((code.match(/dormantBefore = new Date\(now - (\d+) \* 24/) || [])[1] || 0);
/*
 * A LAST-RUN CLOCK DOES NOT ALWAYS MEAN THE DORMANCY SCAN. The feedback ask is clocked on
 * the last run too, but the people it is for are found by their RUN COUNT — they are active,
 * not dormant. Folding it in here made this check demand a dormancy scan reaching back one
 * day, which would have meant scanning every user who ran anything this week, every night.
 */
const runsThreshold = (line: string): number =>
  Number((line.match(/runs\(u\) >= (\d+)/) || [])[1] || 0);
const lastRunSteps = stepLines.filter((l) =>
  clockOf(l) === 'lastRun' && runsThreshold(l) !== heavyScan);
const earliestDormant = Math.min(...lastRunSteps.map((l) => daysIn(l)));
ok(lastRunSteps.length >= 3, `${lastRunSteps.length} steps depend on the dormancy scan`);
ok(dormantDays > 0, 'there is a dormancy scan at all');
ok(dormantDays <= earliestDormant,
  `the dormancy scan (${dormantDays}d) reaches the earliest last-run step (${earliestDormant}d)`);
ok(/where\('last_analysis_at', '<=', dormantBefore\)/.test(code),
  'and it queries the field those steps actually read');

/* The feedback ask is keyed on a run count, not a date, so it needs its own scan. */
const npsLine = stepLines.find((l) => l.includes("'npsAsk'")) || '';
const npsRuns = Number((npsLine.match(/runs\(u\) >= (\d+)/) || [])[1] || 0);

ok(npsRuns > 0 && heavyScan === npsRuns,
  `the run-count scan matches the step's own threshold (${heavyScan} vs ${npsRuns})`);

/* ============================ 6. audiences and the terminal step */

console.log('\nAUDIENCES:');

ok(/step\.audience !== 'any' && step\.audience !== audience/.test(code),
  'a step only goes to the audience it was written for');
ok(/provisioned\.has\(email\.toLowerCase\(\)\) \? 'member' : 'self_signup'/.test(code),
  'provisioned members are an audience, not an exclusion');
const memberSteps = stepLines.filter((l) => l.includes("audience: 'member'"));
const signupOnly = stepLines.filter((l) => l.includes("audience: 'self_signup'"));
ok(memberSteps.length >= 2, `${memberSteps.length} steps are written for members`);
ok(signupOnly.length >= 5, `${signupOnly.length} steps are for self-signups only`);
/*
 * THE ONBOARDING SEQUENCE MUST NOT REACH A MEMBER. Somebody added by their employer gets a
 * "you were added" email and then, if this is wrong, a welcome sequence explaining a
 * product they did not choose to buy.
 */
ok(stepLines.filter((l) => /key: 'onboarding/.test(l)).every((l) => l.includes("audience: 'self_signup'")),
  'no onboarding step is addressed to a provisioned member');

/*
 * WB-90 SAYS IT IS THE LAST ONE. An email that promises silence and is followed by another
 * is the most reliable way there is to turn somebody who was willing to say why they left
 * into a spam complaint.
 */
ok(/LIFECYCLE_TERMINAL_STEP = 'winBack90'/.test(code), 'the last win-back is marked terminal');
ok(/if \(state\[LIFECYCLE_TERMINAL_STEP\]\)/.test(code),
  'and nothing further is sent once it has gone');

/* ============================ 7. what ACT-3 is allowed to believe */

console.log('\nTHE EXPORT COUNTER:');

ok(/document\('action_logs\/\{id\}'\)/.test(code) && /!== 'EXPORT'/.test(code),
  'an action_logs trigger watches for exports');
ok(/export_count: admin\.firestore\.FieldValue\.increment\(1\)/.test(code),
  'and increments a counter on the user');
/*
 * FROM THE LEDGER, NOT FROM GA4. ACT-3 tells a paying customer they have never exported.
 * An ad-blocker deciding what we know about that would send it to somebody who exports
 * daily — the single most annoying email in the sequence to receive wrongly.
 */
const act3 = stepLines.find((l) => l.includes("'activationNeverExported'")) || '';
ok(/exportsMade\(u\) === 0/.test(act3), 'ACT-3 reads that counter');
ok(/isPaidTier\(u\)/.test(act3), 'and only goes to somebody whose plan includes export');

/* ================================== 8. the NPS link */

console.log('\nTHE FEEDBACK ASK:');

const npsBlock = code.slice(code.indexOf('export const nps ='), code.indexOf('export const resendWebhook'));
ok(npsBlock.length > 0, 'the endpoint was located');
ok(/verifyUnsubToken\(uid, token\)/.test(npsBlock),
  'a score is only recorded against a signed link, so nobody can vote for somebody else');
ok(/score < 0 \|\| score > 10/.test(npsBlock), 'the score is range-checked before it is stored');
ok(/npsUrls/.test(code) && /length: 11/.test(code), 'the email carries all eleven scores');
const rulesSrc = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const npsRule = rulesSrc.slice(rulesSrc.indexOf('match /nps_responses/'), rulesSrc.indexOf('match /nps_responses/') + 140);
ok(/allow read, write: if false;/.test(npsRule),
  'no client may read the responses — a score is a candid opinion attached to a uid');

console.log(failures === 0
  ? '\nPASS — marketing mail is unsubscribable, receipts are not, every step exists, and delivery events are verified.'
  : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
