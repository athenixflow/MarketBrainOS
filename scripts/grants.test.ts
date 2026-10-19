// Guards the one rule billing rests on: a signed-in user cannot give themselves paid value.
//
// Until 2026-10 three callables did exactly that. `changeSubscription('upgrade' | 'renew')`
// granted a paid tier with "verify payment with provider here (simulated as success)";
// `confirmTopUp` credited a token pack to any made-up payment reference; and
// `changeSubscription('downgrade')` reset the monthly allowance to the free grant every time it
// was called, including by an account that was already free. The `billing_live` switch only hid
// buttons — anybody calling the function from a console got the plan, the tokens, or a refill.
//
// Plans and tokens are granted by exactly two kinds of code: a VERIFIED payment webhook, and
// the admin callables behind assertAdmin. This guard fails the build if a user-facing callable
// can write a tier or a token credit again.
//
// Runs in `npm run build`. `npm run test:grants` runs it alone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

/* Comments blanked: a file's PROSE must not satisfy a check about its CODE. */
const blank = (text: string) => text
  .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  .replace(/^(\s*)\/\/.*$/gm, (c) => c.replace(/[^\n]/g, ' '))
  .replace(/([^:'"`])\/\/[^\n'"`]*$/gm, '$1');

/** One exported function, from its `export const` to the next one. */
export const exported = (src: string, name: string): string => {
  const start = src.indexOf(`export const ${name} =`);
  if (start < 0) return '';
  const next = src.indexOf('\nexport const ', start + 10);
  return src.slice(start, next < 0 ? undefined : next);
};

/** The text of one `if (action === ...)` branch, up to the next `} else if (action ===`. */
export const branch = (fnSrc: string, opener: string): string => {
  const start = fnSrc.indexOf(opener);
  if (start < 0) return '';
  const next = fnSrc.indexOf('} else if (action ===', start + opener.length);
  return fnSrc.slice(start, next < 0 ? undefined : next);
};

/* What "grants value" looks like in this codebase: a tier write, the balance helper, or a
   purchased-token increment. */
const GRANTS = /\btier\s*:|balanceFields\(|purchased\s*\+|purchased_tokens\s*:/;
const REFUSES = /throw new functions\.https\.HttpsError\(\s*'failed-precondition'/;

export const topUpIsClosed = (fn: string) => fn.length > 0 && REFUSES.test(fn) && !GRANTS.test(fn);
export const upgradeIsClosed = (b: string) => b.length > 0 && REFUSES.test(b) && !GRANTS.test(b);
/* Downgrade may write the free allowance, but only after refusing an account that is already free. */
export const downgradeIsOnce = (b: string) => {
  const guard = b.search(/tier\s*===\s*'free'[\s\S]{0,200}?throw new functions\.https\.HttpsError/);
  const write = b.search(GRANTS);
  return b.length > 0 && guard >= 0 && (write < 0 || guard < write);
};

const index = blank(fs.readFileSync(path.join(root, 'functions', 'src', 'index.ts'), 'utf8'));
const topUp = exported(index, 'confirmTopUp');
const change = exported(index, 'changeSubscription');

console.log('USER-FACING CALLABLES GRANT NOTHING:');
ok(topUpIsClosed(topUp), 'confirmTopUp refuses, and contains no token credit');
ok(upgradeIsClosed(branch(change, "if (action === 'upgrade' || action === 'renew')")),
  'changeSubscription upgrade/renew refuses, and writes no tier or allowance');
ok(downgradeIsOnce(branch(change, "} else if (action === 'downgrade')")),
  'downgrade refuses an account that is already free before writing the free allowance');
ok(/action === 'cancel'/.test(change) && !GRANTS.test(branch(change, "} else if (action === 'cancel')")),
  'cancel still works, and grants nothing');
const expansion = exported(index, 'purchaseExpansion');
ok(expansion.length > 0 && REFUSES.test(expansion) && !/FieldValue\.increment|extra_(seats|members|workspaces|agencies)/.test(expansion),
  'purchaseExpansion refuses, and raises no seat / workspace / agency cap');

/*
 * EVERY EXPORT, NOT A LIST OF SUSPECTS. The first version of this guard checked the three
 * billing callables by name and passed while `manageWorkspace`, `manageAgency` and
 * `manageEnterprise` upgraded whoever created a container (up to Enterprise and 10,000
 * tokens) — the hole had more doors than the names it knew. So every exported function is
 * scanned for a write of a paid tier, and the only ones allowed are listed with a reason.
 * A new function that grants a plan fails the build until somebody adds it here on purpose.
 */
const PAID_TIER_WRITE = /\btier\s*:(?!\s*['"]free['"])(?!\s*string\b)|^\s*tier,\s*$/m;
export const ALLOWED_TIER_WRITERS: Record<string, string> = {
  manageUser: 'admin only (role check inline)',
  adminManageSubscription: 'admin only (assertAdmin)',
  adminBulkAction: 'admin only (assertAdmin)',
  adminCreateUser: 'admin only (assertAdmin)',
  paystackWebhook: 'verified payment webhook (replaced by bachsWebhook)',
  createCheckout: 'writes a checkout record and the requested item; grants nothing',
  manageBilling: 'calls Bachs, then the shared subscription sync (verified state only)',
  lifecycleEmails: 'reads tier into email data; writes no user tier',
  growthDaily: 'reads tier to price revenue; writes no user tier',
};
export const tierWriters = (src: string): string[] =>
  src.split(/\nexport const /).slice(1)
    .filter((part) => PAID_TIER_WRITE.test(part))
    .map((part) => part.slice(0, part.search(/[\s=]/)));
const unexpected = tierWriters(index).filter((name) => !(name in ALLOWED_TIER_WRITERS));
ok(unexpected.length === 0, 'no exported function outside the allowlist writes a paid tier', unexpected.join(', '));
/* The two Bachs grant helpers are plain consts, never exports: the allowlist above can only see
   exported functions, so a helper that became a callable would grant outside it. The leading
   \r? lets the check hold on a CRLF checkout. */
export const grantHelpersAreInternal = (src: string) =>
  /\r?\nconst applyOneOffPayment = async/.test(src) && /\r?\nconst syncSubscriptionById = async/.test(src);
ok(grantHelpersAreInternal(index),
  'the two grant helpers exist and are not exported (no callable can invoke them directly)');
/* Every payment gets the receipt we already have (spec). A dollar subscription's period is paid
   by the webhook, the hourly sync or manageBilling, all through syncSubscriptionById, so the
   receipt lives in that one helper — and only on a grant, never on a no-op or a refusal. The
   body is cut from the helper to the next export; comments are already blanked. */
export const helperBody = (src: string, name: string): string => {
  const start = src.search(new RegExp(`\\r?\\nconst ${name} = async`));
  if (start < 0) return '';
  const next = src.indexOf('\nexport const ', start + 10);
  return src.slice(start, next < 0 ? undefined : next);
};
export const sendsPaymentReceiptOnGrant = (body: string) =>
  /sendTemplate\(\s*[^,]+,\s*'paymentReceipt'/.test(body) && /outcome === 'granted'/.test(body) && /outcome === 'granted\+review'/.test(body);
ok(sendsPaymentReceiptOnGrant(helperBody(index, 'syncSubscriptionById')),
  'syncSubscriptionById sends the paymentReceipt on a granted subscription period');
for (const name of ['manageWorkspace', 'manageAgency', 'manageEnterprise']) {
  const fn = exported(index, name);
  ok(fn.length > 0 && REFUSES.test(fn), `${name} refuses to create a container above the account's plan`);
}

console.log('\nADMIN GRANTS ARE STILL ADMIN-ONLY:');
for (const name of ['adminManageTokens', 'adminManageSubscription', 'adminBulkAction']) {
  const fn = exported(index, name);
  ok(fn.length > 0 && /await assertAdmin\(context\)/.test(fn.slice(0, 400)), `${name} checks assertAdmin first`);
}

console.log('\nTHE STORE DOES NOT OFFER WHAT THE SERVER REFUSES:');
const store = blank(fs.readFileSync(path.join(root, 'components', 'TokenStore.tsx'), 'utf8'));
ok(/fetchBillingStatus\(\)/.test(store), 'components/TokenStore.tsx reads billing_live');
ok(!/callConfirmTopUp\(/.test(store), 'and no longer calls the refused confirmTopUp');
const capacity = blank(fs.readFileSync(path.join(root, 'components', 'CapacityPanel.tsx'), 'utf8'));
ok(/fetchBillingStatus\(\)/.test(capacity) && /canBuy && r\.onBuy/.test(capacity),
  'components/CapacityPanel.tsx shows no Buy button until billing is live');

console.log('\nCONTROLS:');
const leakyTopUp = "export const confirmTopUp = x(async () => { t.update(userRef, { ...balanceFields(monthly, purchased + pack.tokens) }); });";
ok(!topUpIsClosed(leakyTopUp), 'CONTROL: a top-up that credits tokens is caught');
ok(!topUpIsClosed(leakyTopUp + " throw new functions.https.HttpsError('failed-precondition', 'x');"),
  'CONTROL: a refusal does not excuse a credit elsewhere in the same function');
ok(!upgradeIsClosed("if (action === 'upgrade' || action === 'renew') { t.update(userRef, { tier: keptTier }); "),
  'CONTROL: an upgrade branch that writes a tier is caught');
ok(!downgradeIsOnce("} else if (action === 'downgrade') { t.update(userRef, { tier: 'free', ...balanceFields(20, 0) }); "),
  'CONTROL: a downgrade that refills a free account is caught');
ok(tierWriters("x\nexport const sneaky = f(() => { t.update(ref, { tier: 'enterprise' }); });\nexport const fine = f(() => { t.update(ref, { tier: 'free' }); });").join() === 'sneaky',
  'CONTROL: an unknown function writing a paid tier is found, and a free-tier write is not');
ok(tierWriters("x\nexport const shorthand = f(() => { t.update(ref, {\n  tier,\n}); });").join() === 'shorthand',
  'CONTROL: the `tier,` shorthand is found too');
const helpers = "x\nconst applyOneOffPayment = async () => {};\nconst syncSubscriptionById = async () => {};";
ok(grantHelpersAreInternal(helpers) && grantHelpersAreInternal(helpers.replace(/\n/g, '\r\n')),
  'the helper check holds on LF and CRLF checkouts');
ok(!grantHelpersAreInternal(helpers.replace('\nconst applyOneOffPayment', '\nexport const applyOneOffPayment')),
  'CONTROL: an exported applyOneOffPayment is caught');
ok(!grantHelpersAreInternal(helpers.replace('\nconst syncSubscriptionById', '\nexport const syncSubscriptionById')),
  'CONTROL: an exported syncSubscriptionById is caught');
const receiptBody = "\nconst h = async () => { if (outcome === 'granted' || outcome === 'granted+review') { await sendTemplate(user.email, 'paymentReceipt', {}); } };\nexport const next = 1;";
ok(sendsPaymentReceiptOnGrant(helperBody(receiptBody.replace('const h', 'const syncSubscriptionById'), 'syncSubscriptionById')),
  'a helper that mails the receipt on granted and granted+review passes');
ok(!sendsPaymentReceiptOnGrant(helperBody(receiptBody.replace('const h', 'const syncSubscriptionById').replace("'paymentReceipt'", "'billingAlert'"), 'syncSubscriptionById')),
  'CONTROL: a helper that sends no paymentReceipt is caught');
ok(!sendsPaymentReceiptOnGrant(helperBody(receiptBody.replace('const h', 'const syncSubscriptionById').replace(" || outcome === 'granted+review'", ''), 'syncSubscriptionById')),
  'CONTROL: a receipt that skips granted+review (grant applied and flagged) is caught');
const elsewhere = "\nconst syncSubscriptionById = async () => { return 'x'; };\nexport const other = () => { if (outcome === 'granted' || outcome === 'granted+review') sendTemplate(a, 'paymentReceipt', {}); };";
ok(!sendsPaymentReceiptOnGrant(helperBody(elsewhere, 'syncSubscriptionById')),
  'CONTROL: a receipt sent by a different function does not count');
ok(downgradeIsOnce("} else if (action === 'downgrade') { if (userData.tier === 'free') throw new functions.https.HttpsError('failed-precondition', 'x'); t.update(userRef, { tier: 'free' }); "),
  'a downgrade that refuses free accounts first passes');

console.log(failures === 0
  ? '\nPASS — no signed-in user can grant themselves a plan, a token pack or a refill.'
  : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
