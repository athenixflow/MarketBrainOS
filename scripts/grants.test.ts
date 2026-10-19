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
/* WHO MAY CALL THE HELPERS. Keeping them un-exported stops a callable BEING one; it does not stop a
   callable CALLING one. A signed-in user's callable that reached either helper could settle a
   checkout or sync a subscription on the caller's say-so, which is the hole this file exists to
   keep shut. Only the verified webhook, the hourly reconciliation (Task 12; allowed by name now)
   and manageBilling (which syncs FROM Bachs after its own call) may reference them. A helper
   defined between two exports falls inside the preceding export's text, so the helper
   DEFINITIONS are cut out before the references are counted. */
export const GRANT_HELPER_CALLERS: Record<string, string> = {
  bachsWebhook: 'verified Bachs webhook (state synced from Bachs)',
  bachsReconcile: 'hourly reconciliation against Bachs',
  manageBilling: 'syncs the subscription from Bachs after cancelling it',
};
export const helperCallers = (src: string): string[] =>
  src.split(/\nexport const /).slice(1)
    .map((part) => ({
      name: part.slice(0, part.search(/[\s=]/)),
      body: part.replace(/\r?\nconst (?:applyOneOffPayment|syncSubscriptionById) = async/g, ''),
    }))
    .filter((p) => /\b(?:applyOneOffPayment|syncSubscriptionById)\s*\(/.test(p.body))
    .map((p) => p.name);
const callers = helperCallers(index);
const strangers = callers.filter((name) => !(name in GRANT_HELPER_CALLERS));
ok(strangers.length === 0, 'only the webhook, reconciliation and manageBilling reference the two grant helpers', strangers.join(', '));
ok(callers.includes('bachsWebhook') && callers.includes('manageBilling'),
  'and the webhook and manageBilling really do (so the scan above is not vacuous)');
/* Deleting an account must stop its subscription. Bachs keeps charging a card for a product whose
   account is gone, and the customer cannot cancel what they can no longer sign in to. So, in
   deleteAccount: only on a real run (after the dry-run return), only once the re-auth check has
   passed, before any data is removed, for a dollar subscription, and in a try/catch so Bachs
   being down never stops the deletion. */
export const cancelsBillingBeforePurge = (fn: string): boolean => {
  const cancel = fn.search(/cancelSubscriptionAtPeriodEnd\(/);
  if (cancel < 0) return false;
  const after = (re: RegExp) => { const at = fn.search(re); return at >= 0 && at < cancel; };
  const before = (re: RegExp) => { const at = fn.search(re); return at > cancel; };
  /* Comments are blanked to spaces of the same length, so collapse whitespace before looking back. */
  const lead = fn.slice(0, cancel).replace(/\s+/g, ' ').slice(-700);
  return after(/if \(dryRun\)/) && after(/REAUTH_WINDOW_S/) && before(/db\.collection\('deletion_jobs'\)/)
    && /bachs_subscription_id/.test(lead) && /billing_mode === 'subscription'/.test(lead)
    && /try \{(?:(?!catch)[^])*$/.test(lead) && /^[^]{0,400}?\}\s*catch/.test(fn.slice(cancel))
    && /secrets:\s*BACHS_SECRETS/.test(fn.slice(0, 300));
};
ok(cancelsBillingBeforePurge(exported(index, 'deleteAccount')),
  'deleteAccount cancels a dollar subscription (guarded, before the purge) and is bound to the Bachs secrets');
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
/* A paid subscription with no live account (no uid anywhere, or a uid whose user document is
   gone) grants nothing, but the money is still being taken: it must be reviewed ONCE per period
   through the ledger. Two ways to get this wrong, both seen: dropping the case silently, and
   adding a review plus an alert on every webhook and every hourly run. So both branches must
   read the ledger entry under an `orphan:` key, write the review under an id derived from it,
   and never use a bare `.add(`. */
export const orphansAreRecordedOnce = (body: string) =>
  /`orphan:\$\{snap\.id\}:\$\{snap\.currentPeriodStart \?\? 'nostart'\}`/.test(body)
  && (body.match(/t\.get\(ledgerDoc\(orphanKey\)\)/g) || []).length >= 2
  && /billing_reviews'\)\.doc\(ledgerDoc\(orphanKey\)\.id\)/.test(body)
  && !/billing_reviews'\)\.add\(/.test(body)
  && /'orphan reviewed'/.test(body);
ok(orphansAreRecordedOnce(helperBody(index, 'syncSubscriptionById')),
  'syncSubscriptionById records a subscription with no account once per period, through the ledger (both branches)');
/* A subscription that is already on its way out (cancelled at period end, or ended) is not an
   alarm: deleteAccount cancels a deleted account's subscription, and Bachs then reports that very
   cancellation for an account that no longer exists — a review and an email every time would be
   noise about something already dealt with. Only a subscription that is STILL CHARGING
   (active / past_due, not cancelling) is reviewed. So BOTH orphan branches (no account id at all;
   an account id whose document is gone) must read `cancelAtPeriodEnd` (through `leaving`) and
   return before they write. Each branch is found from its own opener to its `orphanWrites(t,`
   call, so one branch's check cannot vouch for the other. */
export const orphansSkipWhenLeaving = (body: string): boolean => {
  const defined = /const leaving = [^;]*cancelAtPeriodEnd === true[^;]*'canceled'[^;]*'unpaid'/.test(body);
  const gate = /if \(leaving\) return 'orphan ignored \(cancelled\)'/;
  const calls = [...body.matchAll(/orphanWrites\(t,/g)].map((m) => m.index as number);
  return defined && calls.length === 2 && calls.every((at) => {
    const opener = Math.max(body.lastIndexOf('if (!uid) {', at), body.lastIndexOf('if (!userSnap.exists) {', at));
    return opener >= 0 && gate.test(body.slice(opener, at));
  });
};
ok(orphansSkipWhenLeaving(helperBody(index, 'syncSubscriptionById')),
  'syncSubscriptionById skips the orphan review and alert for a subscription that is cancelling or ended (both branches)');
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
const orphanBody = [
  "\nconst syncSubscriptionById = async () => {",
  "  const orphanKey = `orphan:${snap.id}:${snap.currentPeriodStart ?? 'nostart'}`;",
  "  if (!uid) { await db.runTransaction(async (t) => { if ((await t.get(ledgerDoc(orphanKey))).exists) return; t.set(db.collection('billing_reviews').doc(ledgerDoc(orphanKey).id), {}); }); return 'orphan reviewed'; }",
  "  await db.runTransaction(async (t) => { if (!userSnap.exists) { if ((await t.get(ledgerDoc(orphanKey))).exists) return 'x'; return 'orphan reviewed'; } });",
  "};",
  "export const next = 1;",
].join('\n');
ok(orphansAreRecordedOnce(helperBody(orphanBody, 'syncSubscriptionById')),
  'a helper that records both orphan cases once through the ledger passes');
ok(!orphansAreRecordedOnce(helperBody(orphanBody.replace("t.set(db.collection('billing_reviews').doc(ledgerDoc(orphanKey).id), {});", "db.collection('billing_reviews').add({});"), 'syncSubscriptionById')),
  'CONTROL: an orphan review added with a bare .add( (repeats forever) is caught');
ok(!orphansAreRecordedOnce(helperBody(orphanBody.replace("if ((await t.get(ledgerDoc(orphanKey))).exists) return 'x'; ", ''), 'syncSubscriptionById')),
  'CONTROL: the user-document-missing branch skipping the ledger read is caught');
ok(!orphansAreRecordedOnce(helperBody(orphanBody.replace("if ((await t.get(ledgerDoc(orphanKey))).exists) return; ", ''), 'syncSubscriptionById')),
  'CONTROL: the no-uid branch skipping the ledger read is caught');
ok(!orphansAreRecordedOnce("\nconst syncSubscriptionById = async () => { if (!userSnap.exists) return 'no account'; };\nexport const next = 1;"),
  'CONTROL: the old silent `return \'no account\'` is caught');
const leavingBody = [
  "\nconst syncSubscriptionById = async () => {",
  "  if (!uid) { const q = 1; }",
  "  const leaving = snap.cancelAtPeriodEnd === true || snap.status === 'canceled' || snap.status === 'unpaid';",
  "  const orphanWrites = (t, reason, forUid) => {};",
  "  if (!uid) { if (leaving) return 'orphan ignored (cancelled)'; await db.runTransaction(async (t) => { orphanWrites(t, 'r', null); }); return 'orphan reviewed'; }",
  "  await db.runTransaction(async (t) => { if (!userSnap.exists) { if (leaving) return 'orphan ignored (cancelled)'; orphanWrites(t, 'r', uid); return 'orphan reviewed'; } });",
  "};",
  "export const next = 1;",
].join('\n');
ok(orphansSkipWhenLeaving(helperBody(leavingBody, 'syncSubscriptionById')),
  'a helper whose two orphan branches both skip a cancelling or ended subscription passes');
ok(!orphansSkipWhenLeaving(helperBody(leavingBody.replace("if (leaving) return 'orphan ignored (cancelled)'; await", 'await'), 'syncSubscriptionById')),
  'CONTROL: the no-account branch reviewing a cancelling subscription is caught');
ok(!orphansSkipWhenLeaving(helperBody(leavingBody.replace("if (leaving) return 'orphan ignored (cancelled)'; orphanWrites", 'orphanWrites'), 'syncSubscriptionById')),
  'CONTROL: the deleted-account branch reviewing a cancelling subscription is caught');
ok(!orphansSkipWhenLeaving(helperBody(leavingBody.replace('snap.cancelAtPeriodEnd === true || ', ''), 'syncSubscriptionById')),
  'CONTROL: a gate that ignores cancel-at-period-end is caught');
ok(!orphansSkipWhenLeaving(helperBody(leavingBody.replace(" || snap.status === 'unpaid'", ''), 'syncSubscriptionById')),
  'CONTROL: a gate that does not treat an unpaid (ended) subscription as leaving is caught');
ok(!orphansSkipWhenLeaving("\nconst syncSubscriptionById = async () => { const orphanWrites = 1; if (!uid) { orphanWrites(t, 'r', null); } };\nexport const next = 1;"),
  'CONTROL: orphan branches with no gate at all are caught');
/* createCheckout and manageBilling are NOT on the tier-writer allowlist, so a tier write added to
   either one later (an upgrade that "just sets the tier") fails the scan above. */
ok(tierWriters("x\nexport const manageBilling = f(() => { t.update(userRef, { tier: target }); });").filter((n) => !(n in ALLOWED_TIER_WRITERS)).join() === 'manageBilling',
  'CONTROL: a manageBilling that writes `tier: target` is flagged');
ok(tierWriters("x\nexport const createCheckout = f(() => { t.update(userRef, { tier: item }); });").filter((n) => !(n in ALLOWED_TIER_WRITERS)).join() === 'createCheckout',
  'CONTROL: a createCheckout that writes a tier is flagged');
ok(downgradeIsOnce("} else if (action === 'downgrade') { if (userData.tier === 'free') throw new functions.https.HttpsError('failed-precondition', 'x'); t.update(userRef, { tier: 'free' }); "),
  'a downgrade that refuses free accounts first passes');
const notAllowed = (names: string[]) => names.filter((n) => !(n in GRANT_HELPER_CALLERS));
const allowedCallers = "x\nexport const bachsWebhook = f(() => { applyOneOffPayment(e, 'webhook'); syncSubscriptionById(a, b, 'webhook'); });\nexport const manageBilling = f(() => { syncSubscriptionById(a, b, 'manage'); });";
ok(notAllowed(helperCallers(allowedCallers)).length === 0 && helperCallers(allowedCallers).length === 2,
  'the webhook and manageBilling calling the helpers are allowed');
ok(notAllowed(helperCallers(allowedCallers + "\nexport const createCheckout = f(async () => { await applyOneOffPayment(e, 'webhook'); });")).join() === 'createCheckout',
  'CONTROL: a callable that calls applyOneOffPayment( is flagged');
ok(notAllowed(helperCallers(allowedCallers + "\nexport const confirmTopUp = f(async () => { await syncSubscriptionById(id, null, 'manage'); });")).join() === 'confirmTopUp',
  'CONTROL: a callable that calls syncSubscriptionById( is flagged');
const withDefs = "x\nexport const createCheckout = f(() => {});\nconst applyOneOffPayment = async (e: any) => 'x';\nconst syncSubscriptionById = async (id: string) => 'y';\nexport const manageBilling = f(() => { syncSubscriptionById(a, b, 'manage'); });";
ok(notAllowed(helperCallers(withDefs)).length === 0 && notAllowed(helperCallers(withDefs.replace(/\n/g, '\r\n'))).length === 0,
  'the helper definitions, which sit inside the preceding export\'s text, are not counted as callers (LF and CRLF)');
ok(helperCallers(blank("x\nexport const createCheckout = f(() => {\n  // applyOneOffPayment(e) is the webhook's job\n});")).length === 0,
  'a comment that names a helper is not a call');
const goodDelete = [
  "export const deleteAccount = functions.runWith({ secrets: BACHS_SECRETS, timeoutSeconds: 300 }).https.onCall(async (data: any, context: any) => {",
  "  if (dryRun) { return 1; }",
  "  if (Date.now() / 1000 - authTime > REAUTH_WINDOW_S) { throw new Error('x'); }",
  "  if (user.bachs_subscription_id && user.billing_mode === 'subscription') {",
  "    try { await bachsApi(process.env.BACHS_SECRET_KEY || '').cancelSubscriptionAtPeriodEnd(id, `cancel_delete_${id}`); }",
  "    catch (e: any) { console.error(e?.message); }",
  "  }",
  "  const jobRef = db.collection('deletion_jobs').doc(uid);",
  "});",
].join('\n');
ok(cancelsBillingBeforePurge(goodDelete), 'a deleteAccount that cancels a dollar subscription, guarded, before the purge passes');
ok(!cancelsBillingBeforePurge(goodDelete.replace('.cancelSubscriptionAtPeriodEnd(', '.somethingElse(')),
  'CONTROL: a deleteAccount that never cancels the subscription is caught');
ok(!cancelsBillingBeforePurge(goodDelete.replace('try { ', '').replace('    catch (e: any) { console.error(e?.message); }', '')),
  'CONTROL: a cancel that is not in a try/catch (Bachs down would block the deletion) is caught');
ok(!cancelsBillingBeforePurge(goodDelete.replace("user.billing_mode === 'subscription'", 'true')),
  'CONTROL: a cancel that is not limited to a dollar subscription is caught');
ok(!cancelsBillingBeforePurge(goodDelete.replace('functions.runWith({ secrets: BACHS_SECRETS, timeoutSeconds: 300 })', 'functions.runWith({ timeoutSeconds: 300 })')),
  'CONTROL: a deleteAccount not bound to the Bachs secrets (so it can never cancel) is caught');
ok(!cancelsBillingBeforePurge(goodDelete.replace("user.bachs_subscription_id && ", '')),
  'CONTROL: a cancel that does not check the account has a subscription id is caught');
ok(!cancelsBillingBeforePurge(goodDelete.replace("  if (dryRun) { return 1; }\n", '').replace("  const jobRef", "  if (dryRun) { return 1; }\n  const jobRef")),
  'CONTROL: a cancel that would also run on a dry run is caught');
ok(!cancelsBillingBeforePurge(goodDelete.replace("  if (Date.now() / 1000 - authTime > REAUTH_WINDOW_S) { throw new Error('x'); }\n", '')),
  'CONTROL: a cancel before the re-authentication check is caught');
const purgeFirst = goodDelete.split('\n');
const jobLine = purgeFirst.splice(7, 1)[0]!;
purgeFirst.splice(3, 0, jobLine);
ok(!cancelsBillingBeforePurge(purgeFirst.join('\n')), 'CONTROL: a cancel that comes after the purge has started is caught');

console.log(failures === 0
  ? '\nPASS — no signed-in user can grant themselves a plan, a token pack or a refill.'
  : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
