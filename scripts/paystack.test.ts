// Guards the Paystack webhook's verification (GTM parts 15, 19 §5; DO-NOW #1).
//
// THIS ENDPOINT IS "POST HERE FOR A FREE AGENCY PLAN" IF THE SIGNATURE CHECK IS WRONG.
// It is a public URL that grants paid tiers, and the only thing between it and anybody on
// the internet is an HMAC comparison. There are no Paystack keys in this project yet, so
// no real webhook has ever reached the handler — which makes this the one part that CAN
// be proved offline, and therefore the part that must be.
//
// What it proves: a correct signature passes, every wrong one fails, the comparison is
// timing-safe, the raw body is what gets verified, an unknown plan code grants nothing,
// and replays are refused. What it cannot prove: that Paystack's real payload matches the
// shapes assumed here. That needs keys and a test-mode transaction, and until then it is
// written down in `functions/src/paystack.ts` rather than assumed away.
//
// Runs in `npm run build`. `npm run test:paystack` runs it alone.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  billingLive, parsePaystackEvent, tierForPlanCode, verifyPaystackSignature,
} from '../functions/src/paystack';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

const SECRET = 'sk_test_0123456789abcdef';
const body = JSON.stringify({
  event: 'charge.success',
  data: {
    reference: 'ref_abc123', amount: 990000, currency: 'NGN',
    metadata: { uid: 'user-1' }, plan: { plan_code: 'PLN_pro_code' },
    customer: { email: 'someone@example.com' },
  },
});
const sign = (payload: string, secret = SECRET) =>
  crypto.createHmac('sha512', secret).update(Buffer.from(payload, 'utf8')).digest('hex');

/* ==================================================== 1. the signature */

console.log('SIGNATURE:');

ok(verifyPaystackSignature(body, sign(body), SECRET) === true,
  'a correctly signed payload is accepted');

/*
 * THE WHOLE POINT, STATED AS A LIST. Each of these is a real way this check has been got
 * wrong in other codebases, and any one of them turns the endpoint into a free-plan
 * dispenser.
 */
ok(verifyPaystackSignature(body, sign(body, 'sk_test_WRONG'), SECRET) === false,
  'a payload signed with a different key is rejected');
ok(verifyPaystackSignature(body + ' ', sign(body), SECRET) === false,
  'a modified body is rejected');
ok(verifyPaystackSignature(body, undefined, SECRET) === false,
  'a missing signature header is rejected');
ok(verifyPaystackSignature(body, sign(body), undefined) === false,
  'no configured secret means rejected, never "allow"');
ok(verifyPaystackSignature(body, '', SECRET) === false,
  'an empty signature is rejected');
ok(verifyPaystackSignature(body, sign(body).slice(0, -1), SECRET) === false,
  'a truncated signature is rejected');
ok(verifyPaystackSignature(body, sign(body).toUpperCase(), SECRET) === false,
  'case is not ignored — hex digests are compared as bytes');
ok(verifyPaystackSignature(body, 'x'.repeat(128), SECRET) === false,
  'a same-length wrong signature is rejected (the timing-safe path)');

/* The algorithm itself, against a vector computed independently of the implementation. */
const vector = crypto.createHmac('sha512', 'secret').update('payload').digest('hex');
ok(verifyPaystackSignature('payload', vector, 'secret') === true,
  'it is HMAC-SHA512 of the body with the secret key, as Paystack documents');

/**
 * Comments blanked, so a file's PROSE cannot satisfy a check about its CODE.
 *
 * The verifier's doc comment explains why the comparison is timing-safe and names
 * `timingSafeEqual` in the explanation — so the first cut of this check passed while the
 * shipped comparison had been replaced with `===`. Its own negative control caught it,
 * which is the third time in this codebase a guard has read a comment as evidence.
 */
const blank = (text: string) => text
  .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  .replace(/^(\s*)\/\/.*$/gm, (c) => c.replace(/[^\n]/g, ' '));

const src = blank(fs.readFileSync(path.join(root, 'functions', 'src', 'paystack.ts'), 'utf8'));
ok(/timingSafeEqual/.test(src),
  'the comparison is timing-safe — a plain === leaks the signature a byte at a time');
ok(!/===\s*signature/.test(src),
  'the signature is never compared with a plain ===');
ok(/sha512/.test(src) && !/sha256/.test(src),
  'sha512, not sha256');

/* ============================== 2. the handler uses the RAW body */

console.log('\nRAW BODY:');
const server = fs.readFileSync(path.join(root, 'functions', 'src', 'index.ts'), 'utf8');
const hook = blank(server.slice(server.indexOf('export const paystackWebhook'), server.indexOf('export const billingStatus')));
/* The prose assertions below need the unblanked text; the behavioural ones use `hook`. */
const hookProse = server.slice(server.indexOf('export const paystackWebhook'), server.indexOf('export const billingStatus'));

/*
 * RE-SERIALISING IS THE CLASSIC FAILURE. Firebase parses JSON before the handler sees it,
 * and `JSON.stringify(req.body)` can reorder keys or reformat numbers — so honest
 * requests fail, and the usual "fix" is to weaken the check until they pass.
 */
ok(/req as any\)\.rawBody/.test(hook), 'the handler verifies req.rawBody');
ok(!/JSON\.stringify\(req\.body\)/.test(hook), 'it never verifies a re-serialised body');
ok(/if \(!raw\)/.test(hook) && /res\.status\(400\)/.test(hook),
  'a missing rawBody refuses rather than falling back to the parsed object');
ok(/res\.status\(401\)/.test(hook), 'a bad signature is a 401');

/* ================================ 3. what an event may grant */

console.log('\nGRANTS:');

const env = { PAYSTACK_PLAN_PRO: 'PLN_pro_code', PAYSTACK_PLAN_TEAM: 'PLN_team_code' };
ok(tierForPlanCode('PLN_pro_code', env) === 'pro', 'a known plan code maps to its tier');
ok(tierForPlanCode('PLN_team_code', env) === 'team', 'each code maps to its own tier');
/*
 * FAIL CLOSED. A typo in the Paystack dashboard, or a live code reaching a test
 * deployment, must grant NOTHING — not a default tier, which is how somebody ends up with
 * an Agency plan for a Pro payment.
 */
ok(tierForPlanCode('PLN_unknown', env) === null, 'an unrecognised plan code grants nothing');
ok(tierForPlanCode(null, env) === null, 'a missing plan code grants nothing');
ok(tierForPlanCode('PLN_pro_code', {}) === null, 'with no codes configured, nothing is granted');
/* An empty env var must not match an absent plan code and silently grant a tier. */
ok(tierForPlanCode('', { PAYSTACK_PLAN_PRO: '' }) === null,
  'an empty code does not match an empty configured value');

/* ================================ 4. reading an event */

console.log('\nEVENTS:');
const parsed = parsePaystackEvent(JSON.parse(body));
ok(parsed?.type === 'charge.success' && parsed.uid === 'user-1' && parsed.amountMinor === 990000,
  'a charge.success is read into uid, amount and plan');
ok(parsed?.currency === 'NGN', 'the currency travels with the amount');
ok(parsePaystackEvent({ event: 'customeridentification.success' }) === null,
  'an event we do not act on is ignored rather than mishandled');
ok(parsePaystackEvent({}) === null, 'a payload with no event is ignored');
/*
 * IT MUST NOT THROW. This runs on input from the public internet, and an exception is a
 * 500 — which Paystack retries, turning one malformed payload into a retry storm.
 */
let threw = false;
try { parsePaystackEvent({ event: 'charge.success', data: null }); } catch { threw = true; }
ok(!threw, 'a malformed payload returns rather than throwing (a 500 would be retried forever)');

/* The uid comes from OUR metadata, never the customer email: two accounts can share an
   address, and a customer can change theirs at the bank. */
const noMeta = parsePaystackEvent({
  event: 'charge.success',
  data: { reference: 'r', amount: 1, customer: { email: 'a@b.c' } },
});
ok(noMeta?.uid === null, 'no metadata uid means no uid — never inferred from the email');
ok(/without a uid in metadata/.test(hookProse), 'the handler refuses to guess whose payment it was');

/* ============================== 5. replays and acknowledgement */

console.log('\nRETRIES:');
ok(/payment_events/.test(hook) && /alreadySeen/.test(hook),
  'the event reference is recorded so a retry is a no-op');
/* The GUARD, not the message: `if (false) { ... 'Already handled' ... }` keeps the string
   and loses the protection, which is what this check's own control did. */
ok(/if \(alreadySeen\)[\s\S]{0,80}return;/.test(hook),
  'a replay is acknowledged, not reprocessed');
ok(/const alreadySeen = await db\.runTransaction/.test(hook),
  'the replay check and the record are one transaction, so two retries cannot race');
ok(/res\.status\(200\)\.send\('Ignored'\)/.test(hook),
  'an event we do not handle gets a 200 — a 500 would be retried forever');

/* Cancelling must not take away days somebody paid for. */
ok(/Access is NOT revoked here/.test(hookProse) && /subscription_status: 'cancelled'/.test(hook)
  && !/tier: 'free'/.test(hook),
  'a cancellation ends renewal without revoking the paid period');

/* ================================ 6. the switch */

console.log('\nBILLING FLAG:');
ok(billingLive({}) === false, 'billing is not live without keys');
ok(billingLive({ PAYSTACK_BILLING_LIVE: 'true' }) === false,
  'a flag alone does not make billing live — a Pay button that cannot charge is worse than none');
ok(billingLive({ PAYSTACK_SECRET_KEY: 'sk', PAYSTACK_BILLING_LIVE: 'true' }) === true,
  'keys plus the flag means live');
ok(billingLive({ PAYSTACK_SECRET_KEY: 'sk' }) === false, 'keys alone do not flip it either');

/* ============================ 7. the flag reaches the buttons */

console.log('\nTHE SWITCH IS WIRED:');

/*
 * BUILT AND READ BY NOTHING IS THE FAILURE THIS CODEBASE KEEPS MEETING. `billingStatus`
 * shipped as an endpoint no screen called, which is the same shape as a seam with nothing
 * plugged into it: the code is correct, nothing runs it, and the product goes on offering
 * a Pay button that cannot charge.
 *
 * What it prevents concretely: until Paystack is live, `changeSubscription('upgrade')`
 * grants a paid tier and takes no money — so an ungated button both promises a charge
 * that never arrives AND hands out the plan for free.
 */
/*
 * SCOPED TO THE FUNCTION EACH CLAIM IS ABOUT. The first cut searched whole files, and all
 * three of its controls were MISSED because the strings it looked for also appear
 * elsewhere in the same file: `billingLive === false` in the button's label branch as
 * well as its action, `billing_live: false` on two separate error paths, and
 * `action === 'upgrade' || action === 'renew'` in the analytics call above the gate. A
 * whole-file grep answers "does this text exist", not "does this code do that".
 */
const fnBody = (text: string, start: string): string => {
  const at = text.indexOf(start);
  if (at < 0) return '';
  /* To the next top-level `const x = ` / `return (` at the same indent — crude, and it
     only has to be tight enough that a neighbouring function is not swept in. */
  const rest = text.slice(at + start.length);
  const end = rest.search(/\n  (?:const|return|function) /);
  return end < 0 ? rest : rest.slice(0, end);
};

const billingSvc = blank(fs.readFileSync(path.join(root, 'services', 'billing.ts'), 'utf8'));
ok(/billingStatus/.test(billingSvc), 'the client reads the billingStatus endpoint');
/* EVERY exit that is not a confirmed "live" must answer false — one of two error paths
   failing open is enough to show a Pay button that cannot charge. */
ok(!/billing_live:\s*true/.test(billingSvc),
  'it fails CLOSED — no path answers "live" except a confirmed one');
ok((billingSvc.match(/billing_live: false/g) || []).length >= 2,
  'both the error and the non-OK response answer "not live"');

const pricing = blank(fs.readFileSync(path.join(root, 'pages', 'Pricing.tsx'), 'utf8'));
ok(/fetchBillingStatus\(\)/.test(pricing), 'pages/Pricing.tsx reads the flag');
ok(/billingLive === false/.test(fnBody(pricing, 'const select = async')),
  'pages/Pricing.tsx gates its upgrade ACTION, not just the button label');

const panel = blank(fs.readFileSync(path.join(root, 'components', 'SubscriptionPanel.tsx'), 'utf8'));
ok(/fetchBillingStatus\(\)/.test(panel), 'components/SubscriptionPanel.tsx reads the flag');
const runBody = fnBody(panel, 'const run = async');
ok(/billingLive === false/.test(runBody),
  'components/SubscriptionPanel.tsx gates its upgrade path on it');

/*
 * CANCELLING STAYS AVAILABLE. Gating it would trap somebody in a plan because WE cannot
 * take payments — punishing the customer for our own missing integration.
 */
const gateLine = (runBody.split('\n').find((l) => /billingLive === false/.test(l))) ?? '';
ok(/action === 'upgrade' \|\| action === 'renew'/.test(gateLine),
  'only upgrade and renew are gated — cancel and downgrade stay open');

console.log(failures === 0
  ? '\nPASS — only Paystack can grant a plan, once, an unknown code grants nothing, and the switch reaches the buttons.'
  : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
