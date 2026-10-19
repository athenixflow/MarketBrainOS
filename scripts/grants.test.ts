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
   DEFINITIONS (their bodies mention their own names in log lines) are cut out before the
   references are counted. ANY reference counts, not only a call: `items.map(syncSubscriptionById)`
   or `const go = applyOneOffPayment` reaches the helper just as surely as `syncSubscriptionById(`. */
export const GRANT_HELPER_CALLERS: Record<string, string> = {
  bachsWebhook: 'verified Bachs webhook (state synced from Bachs)',
  bachsReconcile: 'hourly reconciliation against Bachs',
  manageBilling: 'syncs the subscription from Bachs after cancelling it',
};
export const helperCallers = (src: string): string[] =>
  src.split(/\nexport const /).slice(1)
    .map((part) => ({
      name: part.slice(0, part.search(/[\s=]/)),
      body: part
        .replace(/\r?\nconst (?:applyOneOffPayment|syncSubscriptionById) = async[^]*?\r?\n\};/g, '')
        .replace(/\r?\nconst (?:applyOneOffPayment|syncSubscriptionById) = async/g, ''),
    }))
    .filter((p) => /\b(?:applyOneOffPayment|syncSubscriptionById)\b/.test(p.body))
    .map((p) => p.name);
const callers = helperCallers(index);
const strangers = callers.filter((name) => !(name in GRANT_HELPER_CALLERS));
ok(strangers.length === 0, 'only the webhook, reconciliation and manageBilling reference the two grant helpers', strangers.join(', '));
ok(callers.includes('bachsWebhook') && callers.includes('manageBilling'),
  'and the webhook and manageBilling really do (so the scan above is not vacuous)');
/* A Bachs-billed account's allowance resets only when money arrives (an invoice, a pass), never on
   a date: the daily refresh would hand a lapsed, unpaid dollar subscription — or a pass past its
   expiry — a fresh month. So its `due` filter must skip both billing modes. */
export const refreshSkipsBilled = (fn: string): boolean =>
  /billing_mode === 'subscription' \|\| u\.billing_mode === 'pass'/.test(fn);
const refresh = exported(index, 'monthlyTokenRefresh');
ok(refresh.length > 0 && refreshSkipsBilled(refresh),
  'monthlyTokenRefresh skips Bachs-billed accounts (their allowance resets only when money arrives)');
/* HOW THE THREE SCHEDULED BILLING JOBS RUN. The reconciliation is the only one of them that can
   grant (through the same two helpers as the webhook), and it must be a SCHEDULED function: an
   onCall or onRequest version would be a public door to the grant helpers, reachable by whoever
   finds the URL. It never reads the webhook secret, so it is bound to the API key alone. The pass
   lifecycle and the daily check call Bachs not at all, so they are bound to no Bachs secret. */
export const isScheduledOnly = (fn: string): boolean =>
  fn.length > 0 && /\.pubsub\.schedule\(/.test(fn) && !/\.https\./.test(fn);
export const bindsOnlyBachsKey = (fn: string): boolean => {
  const head = fn.slice(0, 300);
  return /secrets:\s*\['BACHS_SECRET_KEY'\]/.test(head) && !/BACHS_WEBHOOK_SECRET|BACHS_SECRETS/.test(head);
};
export const bindsNoBachsSecret = (fn: string): boolean => fn.length > 0 && !/BACHS_/.test(fn.slice(0, 300));
const reconcile = exported(index, 'bachsReconcile');
ok(isScheduledOnly(reconcile), 'bachsReconcile is a scheduled function (no onCall, no onRequest)');
ok(bindsOnlyBachsKey(reconcile), 'and it is bound to the Bachs key only, never the webhook secret');
for (const name of ['passLifecycle', 'billingDailyCheck']) {
  const fn = exported(index, name);
  ok(isScheduledOnly(fn) && bindsNoBachsSecret(fn), `${name} is a scheduled function and is bound to no Bachs secret`);
}
/* THE JOBS MUST NOT QUIETLY STOP FINISHING. Each of these shapes was a real defect once, and each
   fails silently: the run just ends early and the same accounts are skipped every day.
   - passLifecycle opened a transaction for EVERY pass holder under the default 60s timeout; at
     enough accounts it timed out part-way, and the same tail never got an expiry or a reminder.
     So it looks at the query snapshot first and transacts only for an account that is expiring or
     due a reminder, re-checks inside the transaction, runs with 300s, and writes through the
     transaction only (a reminder mark written outside it can resurrect a stale "5 days" flag after
     a renewal reset the list). */
export const passLifecycleIsBounded = (fn: string): boolean => {
  const tx = fn.indexOf('runTransaction(');
  return fn.length > 0 && tx > 0
    && /timeoutSeconds:\s*300/.test(fn.slice(0, 300))
    && fn.indexOf('expirePass(') >= 0 && fn.indexOf('expirePass(') < tx && fn.indexOf('expirePass(', tx) > tx
    && fn.indexOf('reminderDue(') >= 0 && fn.indexOf('reminderDue(') < tx && fn.indexOf('reminderDue(', tx) > tx
    && fn.indexOf('arrayUnion(') > tx
    && !/\.ref\.(?:update|set)\(/.test(fn);
};
ok(passLifecycleIsBounded(exported(index, 'passLifecycle')),
  'passLifecycle checks the snapshot before it transacts, re-checks inside, marks reminders inside, and runs with 300s');
/* - billingDailyCheck read 500 documents with no order and no time filter, so past 500 it counted
     the OLDEST ones and missed today's. Both reads are now a 24h range on created_at (a single-field
     index, no composite), with `source` filtered in code. */
export const dailyCheckReadsItsWindow = (fn: string): boolean =>
  fn.length > 0
  && /collection\('payment_events'\)\s*\.where\('created_at', '>=', /.test(fn)
  && /collection\('billing_reviews'\)\s*\.where\('created_at', '>=', /.test(fn)
  && !/where\('source'/.test(fn) && /source === 'reconcile'/.test(fn)
  && !/\.limit\(500\)/.test(fn);
ok(dailyCheckReadsItsWindow(exported(index, 'billingDailyCheck')),
  'billingDailyCheck reads the last 24h by created_at (no unordered limit, no composite index)');
/* - bachsReconcile read the first 200 checkouts and 500 subscribers by document id every hour, so
     past that the same accounts were never reconciled. It pages by document id with a cursor kept
     in platform_settings/reconcile_cursor and stops on a deadline, wrapping when a page is short. */
export const reconcilePagesByCursor = (fn: string): boolean =>
  fn.length > 0
  && /orderBy\(admin\.firestore\.FieldPath\.documentId\(\)\)/.test(fn) && /\.startAfter\(/.test(fn)
  && /platform_settings'\)\.doc\('reconcile_cursor'\)/.test(fn)
  && /subscriptions_after/.test(fn) && /checkouts_after/.test(fn)
  && /Date\.now\(\) >/.test(fn)
  && !/\.limit\((?:200|500)\)/.test(fn);
ok(reconcilePagesByCursor(reconcile),
  'bachsReconcile pages checkouts and subscribers by document id with a persisted cursor and a deadline');
/* - Nothing may write a subscription or customer id from reconciliation (the sync adopts them under
     its current-subscription rules), and the job never alerts (the helpers do). */
export const reconcileWritesNoIdsAndNeverAlerts = (fn: string): boolean =>
  fn.length > 0 && !/bachs_(?:subscription|customer)_id\s*[:,}]|billingAlertEmail/.test(fn);
ok(reconcileWritesNoIdsAndNeverAlerts(reconcile), 'bachsReconcile writes no subscription or customer id and sends no alert of its own');
/* - A plan checkout is marked paid only AFTER the sync succeeded, in the webhook and in
     reconciliation alike: marked first, a sync that keeps failing leaves a checkout that looks
     settled with nothing granted, and reconciliation (which reads only OPEN ones) never retries it. */
export const syncsBeforeMarkingPaid = (branchText: string): boolean => {
  const sync = branchText.indexOf('syncSubscriptionById(');
  const mark = branchText.search(/status: 'paid'/);
  return sync >= 0 && mark > sync;
};
export const between = (src: string, from: string, to: string): string => {
  const a = src.indexOf(from);
  const b = a < 0 ? -1 : src.indexOf(to, a + from.length);
  return a < 0 || b < 0 ? '' : src.slice(a, b);
};
ok(syncsBeforeMarkingPaid(between(exported(index, 'bachsWebhook'), "event.kind === 'subscription_linked'", "event.kind === 'subscription_changed'")),
  'the webhook syncs a linked subscription before it marks the checkout paid');
ok(syncsBeforeMarkingPaid(between(reconcile, "s?.paid && c.kind === 'plan'", 'else if (s?.paid)')),
  'reconciliation syncs a paid plan checkout before it marks it paid');
/* Deleting an account must stop its subscription. Bachs keeps charging a card for a product whose
   account is gone, and the customer cannot cancel what they can no longer sign in to. So, in
   deleteAccount: only on a real run (after the dry-run return), only once the re-auth check has
   passed, before any data is removed, for a dollar subscription, and in a try/catch so Bachs
   being down never stops the deletion. Three more ways to defeat that, each guarded: a catch
   that RETHROWS (the failure then stops the deletion after all); a catch that AWAITS the founder
   alert (a hanging mail provider then delays the purge — it is fire-and-forget); and a binding
   wider than it needs (deleteAccount reads the key, never the webhook secret). */
export const cancelsBillingBeforePurge = (fn: string): boolean => {
  const cancel = fn.search(/cancelSubscriptionAtPeriodEnd\(/);
  if (cancel < 0) return false;
  const purge = fn.search(/db\.collection\('deletion_jobs'\)/);
  if (purge < cancel) return false;
  const after = (re: RegExp) => { const at = fn.search(re); return at >= 0 && at < cancel; };
  /* Comments are blanked to spaces of the same length, so collapse whitespace before looking back. */
  const lead = fn.slice(0, cancel).replace(/\s+/g, ' ').slice(-700);
  const between = fn.slice(cancel, purge);
  const catchAt = between.search(/\bcatch\b/);
  const head = fn.slice(0, 300);
  return after(/if \(dryRun\)/) && after(/REAUTH_WINDOW_S/)
    && /bachs_subscription_id/.test(lead) && /billing_mode === 'subscription'/.test(lead)
    && /try \{(?:(?!catch)[^])*$/.test(lead) && /^[^]{0,400}?\}\s*catch/.test(fn.slice(cancel))
    && catchAt >= 0 && !/\bthrow\b/.test(between.slice(catchAt))
    && !/\bawait\s+(?:billingAlertEmail|sendTemplate)\b/.test(between)
    && /secrets:\s*\['BACHS_SECRET_KEY'\]/.test(head) && !/BACHS_WEBHOOK_SECRET|BACHS_SECRETS/.test(head);
};
ok(cancelsBillingBeforePurge(exported(index, 'deleteAccount')),
  'deleteAccount cancels a dollar subscription (guarded, before the purge, never fatal, never waiting on mail) and binds only the Bachs key');
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
   (active / past_due, not cancelling) is reviewed — and so is a cancelling one whose delivery
   CARRIED A CHARGE (`chargedMinor` set: an invoice was paid for an account that is gone, which is
   money to chase whatever the subscription's state). So BOTH orphan branches (no account id at
   all; an account id whose document is gone) must read `cancelAtPeriodEnd` (through `leaving`),
   and may return before they write only when no charge came with the event. Each branch is found
   from its own opener to its `orphanWrites(t,` call, so one branch's check cannot vouch for the
   other. */
export const orphansSkipWhenLeaving = (body: string): boolean => {
  const defined = /const leaving = [^;]*cancelAtPeriodEnd === true[^;]*'canceled'[^;]*'unpaid'/.test(body);
  const gate = /if \(leaving && chargedMinor === null\) return 'orphan ignored \(cancelled\)'/;
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
ok(/fetchBillingStatus\(\)/.test(store) && /startCheckout\('pack'/.test(store), 'components/TokenStore.tsx buys packs through checkout, gated on billing status');
ok(!/callConfirmTopUp\(/.test(store), 'and never calls the refused confirmTopUp');
const capacity = blank(fs.readFileSync(path.join(root, 'components', 'CapacityPanel.tsx'), 'utf8'));
ok(/fetchBillingStatus\(\)/.test(capacity) && /canBuy && r\.onBuy/.test(capacity),
  'components/CapacityPanel.tsx shows no Buy button until billing is live');

/* THE RETURN FROM A CHECKOUT IS ACKNOWLEDGED WHERE THE CUSTOMER LANDS. The server sends people back
   to /billing?checkout=success|cancelled; the plan panel that used to read the parameter lives in
   Settings and the Dashboard, so on /billing a paid customer saw nothing at all. */
export const acknowledgesCheckoutReturn = (page: string): boolean =>
  /URLSearchParams\([^)]*\)\.get\('checkout'\)/.test(page)
  && /=== 'success'/.test(page) && /=== 'cancelled'/.test(page) && /refreshProfile\(\)/.test(page)
  /* The webhook lands a few seconds after the redirect, so one immediate refresh shows the old plan:
     it is refreshed again on a timer, and the timers are cleared when the page goes. */
  && /setTimeout\(/.test(page) && /clearTimeout\(/.test(page);
/** A naira pass has an END, not a renewal, and is priced in naira: the billing page must say so. */
export const showsPassTerms = (page: string): boolean =>
  /billing_mode === 'pass'/.test(page) && /pass_expires_at/.test(page) && /'Ends'/.test(page)
  && /formatPrice\(/.test(page) && /\/30 days/.test(page);
console.log('\nTHE CHECKOUT RETURN IS ACKNOWLEDGED:');
const app = blank(fs.readFileSync(path.join(root, 'App.tsx'), 'utf8'));
ok(/success_url: `\$\{SITE\}\/billing\?checkout=success`/.test(index) && /cancel_url: `\$\{SITE\}\/billing\?checkout=cancelled`/.test(index),
  'a checkout sends the customer back to /billing, with the outcome in the query');
ok(/path="\/billing" element=\{[^}]*<BillingCenter \/>/.test(app), 'the /billing route renders pages/BillingCenter.tsx');
ok(acknowledgesCheckoutReturn(blank(fs.readFileSync(path.join(root, 'pages', 'BillingCenter.tsx'), 'utf8'))),
  'pages/BillingCenter.tsx reads the checkout outcome, says so, and refreshes the profile on success');
const billingPage = blank(fs.readFileSync(path.join(root, 'pages', 'BillingCenter.tsx'), 'utf8'));
ok(showsPassTerms(billingPage), 'pages/BillingCenter.tsx shows a naira pass as ₦ per 30 days that ENDS (not a dollar price that renews)');
ok(!showsPassTerms("const renews = profile.plan_renews_at ? new Date(profile.plan_renews_at).toLocaleDateString() : 'Not set'; <Stat label=\"Renews\" value={renews} /> <Stat label=\"Price\" value={`$${price}/mo`} />"),
  'CONTROL: a billing page that gives a pass holder a dollar price and a renewal date is caught');
ok(!acknowledgesCheckoutReturn("const q = new URLSearchParams(window.location.search).get('checkout'); if (q === 'success') { void refreshProfile(); } if (q === 'cancelled') setReturned('cancelled');"),
  'CONTROL: a page that refreshes only once (no timers) is caught');
ok(!acknowledgesCheckoutReturn("const BillingCenter = () => { const { profile } = useAuth(); return <TokenStore />; };"),
  'CONTROL: a billing page that ignores the checkout outcome is caught');
ok(!acknowledgesCheckoutReturn("const q = new URLSearchParams(window.location.search).get('checkout'); if (q === 'success') { void refreshProfile(); }"),
  'CONTROL: a page that never speaks to a cancelled checkout is caught');

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
  "  if (!uid) { if (leaving && chargedMinor === null) return 'orphan ignored (cancelled)'; await db.runTransaction(async (t) => { orphanWrites(t, 'r', null); }); return 'orphan reviewed'; }",
  "  await db.runTransaction(async (t) => { if (!userSnap.exists) { if (leaving && chargedMinor === null) return 'orphan ignored (cancelled)'; orphanWrites(t, 'r', uid); return 'orphan reviewed'; } });",
  "};",
  "export const next = 1;",
].join('\n');
const quiet = "if (leaving && chargedMinor === null) return 'orphan ignored (cancelled)';";
ok(orphansSkipWhenLeaving(helperBody(leavingBody, 'syncSubscriptionById')),
  'a helper whose two orphan branches both skip a cancelling or ended subscription with no charge passes');
ok(!orphansSkipWhenLeaving(helperBody(leavingBody.replace(`${quiet} await`, 'await'), 'syncSubscriptionById')),
  'CONTROL: the no-account branch reviewing a cancelling subscription is caught');
ok(!orphansSkipWhenLeaving(helperBody(leavingBody.replace(`${quiet} orphanWrites`, 'orphanWrites'), 'syncSubscriptionById')),
  'CONTROL: the deleted-account branch reviewing a cancelling subscription is caught');
ok(!orphansSkipWhenLeaving(helperBody(leavingBody.replace(`${quiet} await`, "if (leaving) return 'orphan ignored (cancelled)'; await"), 'syncSubscriptionById')),
  'CONTROL: the no-account branch ignoring a cancelling orphan even when a charge came with the event is caught');
ok(!orphansSkipWhenLeaving(helperBody(leavingBody.replace(`${quiet} orphanWrites`, "if (leaving) return 'orphan ignored (cancelled)'; orphanWrites"), 'syncSubscriptionById')),
  'CONTROL: the deleted-account branch ignoring a cancelling orphan even when a charge came with the event is caught');
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
ok(notAllowed(helperCallers(allowedCallers + "\nexport const sneaky = f(async () => (ids as string[]).map(syncSubscriptionById));")).join() === 'sneaky',
  'CONTROL: a callable that passes syncSubscriptionById by reference is flagged');
ok(notAllowed(helperCallers(allowedCallers + "\nexport const aliased = f(async () => { const go = applyOneOffPayment; await go(e, 'webhook'); });")).join() === 'aliased',
  'CONTROL: a callable that aliases applyOneOffPayment is flagged');
const withBodies = "x\nexport const resendWebhook = f(() => {});\nconst applyOneOffPayment = async (e: any) => {\n  try { return 1; } catch (err) { console.error('applyOneOffPayment: notification failed:'); }\n};\n"
  + "const syncSubscriptionById = async (id: string) => {\n  console.error('syncSubscriptionById: orphan alert failed:');\n  return 'x';\n};\nexport const createCheckout = f(() => {});\nexport const manageBilling = f(() => { syncSubscriptionById(a, b, 'manage'); });";
ok(notAllowed(helperCallers(withBodies)).length === 0 && notAllowed(helperCallers(withBodies.replace(/\n/g, '\r\n'))).length === 0,
  'the helper BODIES, whose log lines name them, are not counted as references either (LF and CRLF)');
const catchLine = "    catch (e: any) { console.error(e?.message); void billingAlertEmail('x', []).catch(() => undefined); }";
const goodDelete = [
  "export const deleteAccount = functions.runWith({ secrets: ['BACHS_SECRET_KEY'], timeoutSeconds: 300 }).https.onCall(async (data: any, context: any) => {",
  "  if (dryRun) { return 1; }",
  "  if (Date.now() / 1000 - authTime > REAUTH_WINDOW_S) { throw new Error('x'); }",
  "  if (user.bachs_subscription_id && user.billing_mode === 'subscription') {",
  "    try { await bachsApi(process.env.BACHS_SECRET_KEY || '').cancelSubscriptionAtPeriodEnd(id, `cancel_delete_${id}`); }",
  catchLine,
  "  }",
  "  const jobRef = db.collection('deletion_jobs').doc(uid);",
  "});",
].join('\n');
ok(cancelsBillingBeforePurge(goodDelete), 'a deleteAccount that cancels a dollar subscription, guarded, before the purge passes');
ok(!cancelsBillingBeforePurge(goodDelete.replace('.cancelSubscriptionAtPeriodEnd(', '.somethingElse(')),
  'CONTROL: a deleteAccount that never cancels the subscription is caught');
ok(!cancelsBillingBeforePurge(goodDelete.replace('try { ', '').replace(`${catchLine}\n`, '')),
  'CONTROL: a cancel that is not in a try/catch (Bachs down would block the deletion) is caught');
ok(!cancelsBillingBeforePurge(goodDelete.replace(catchLine, '    catch (e) { throw e; }')),
  'CONTROL: a catch that rethrows (so Bachs being down still blocks the deletion) is caught');
ok(!cancelsBillingBeforePurge(goodDelete.replace(catchLine, "    catch (e: any) { console.error(e?.message); throw new Error('x'); }")),
  'CONTROL: a catch that throws something else is caught too');
ok(!cancelsBillingBeforePurge(goodDelete.replace('void billingAlertEmail', 'await billingAlertEmail')),
  'CONTROL: a catch that waits on the founder alert (a hanging mail provider would delay the purge) is caught');
ok(!cancelsBillingBeforePurge(goodDelete.replace('void billingAlertEmail', 'await sendTemplate')),
  'CONTROL: a catch that waits on any mail is caught');
ok(!cancelsBillingBeforePurge(goodDelete.replace("user.billing_mode === 'subscription'", 'true')),
  'CONTROL: a cancel that is not limited to a dollar subscription is caught');
ok(!cancelsBillingBeforePurge(goodDelete.replace("secrets: ['BACHS_SECRET_KEY'], ", '')),
  'CONTROL: a deleteAccount not bound to the Bachs key (so it can never cancel) is caught');
ok(!cancelsBillingBeforePurge(goodDelete.replace("secrets: ['BACHS_SECRET_KEY']", 'secrets: BACHS_SECRETS')),
  'CONTROL: a deleteAccount bound to both Bachs secrets (it never reads the webhook secret) is caught');
ok(!cancelsBillingBeforePurge(goodDelete.replace("secrets: ['BACHS_SECRET_KEY']", "secrets: ['BACHS_SECRET_KEY', 'BACHS_WEBHOOK_SECRET']")),
  'CONTROL: a deleteAccount that lists the webhook secret too is caught');
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
const goodRefresh = "export const monthlyTokenRefresh = f(async () => {\n  const due = snap.docs.filter((d) => {\n    if (u.billing_mode === 'subscription' || u.billing_mode === 'pass') return false;\n    return true;\n  });\n});";
ok(refreshSkipsBilled(goodRefresh), 'a refresh that skips subscription and pass accounts passes');
ok(!refreshSkipsBilled(goodRefresh.replace("u.billing_mode === 'subscription' || ", '')),
  'CONTROL: a refresh that skips passes but still refreshes dollar subscriptions is caught');
ok(!refreshSkipsBilled(goodRefresh.replace(" || u.billing_mode === 'pass'", '')),
  'CONTROL: a refresh that skips subscriptions but still refreshes naira passes is caught');
ok(!refreshSkipsBilled(goodRefresh.replace("    if (u.billing_mode === 'subscription' || u.billing_mode === 'pass') return false;\n", '')),
  'CONTROL: a refresh with no billed-account exclusion is caught');
const goodReconcile = "export const bachsReconcile = functions.runWith({ secrets: ['BACHS_SECRET_KEY'], timeoutSeconds: 300 })\n  .pubsub.schedule('every 60 minutes').onRun(async () => { await syncSubscriptionById(id, null, 'reconcile'); return null; });";
ok(isScheduledOnly(goodReconcile) && bindsOnlyBachsKey(goodReconcile) && bindsNoBachsSecret(goodReconcile.replace("secrets: ['BACHS_SECRET_KEY'], ", '')),
  'a scheduled reconciliation bound to the key alone passes');
ok(!isScheduledOnly(goodReconcile.replace(".pubsub.schedule('every 60 minutes').onRun(async () =>", '.https.onRequest(async (req, res) =>')),
  'CONTROL: a reconciliation that became an onRequest endpoint is caught');
ok(!isScheduledOnly(goodReconcile.replace(".pubsub.schedule('every 60 minutes').onRun(async () =>", '.https.onCall(async (data, context) =>')),
  'CONTROL: a reconciliation that became a callable is caught');
ok(!isScheduledOnly(goodReconcile.replace(".pubsub.schedule('every 60 minutes')", '')),
  'CONTROL: a reconciliation that is no longer scheduled is caught');
ok(!isScheduledOnly(goodReconcile.replace('return null;', 'return functions.https.onRequest(h);')),
  'CONTROL: a scheduled reconciliation that also exposes an https handler is caught');
ok(!isScheduledOnly(''), 'CONTROL: a missing reconciliation is not "scheduled"');
ok(!bindsOnlyBachsKey(goodReconcile.replace("secrets: ['BACHS_SECRET_KEY']", 'secrets: BACHS_SECRETS')),
  'CONTROL: a reconciliation bound to both Bachs secrets is caught');
ok(!bindsOnlyBachsKey(goodReconcile.replace("secrets: ['BACHS_SECRET_KEY']", "secrets: ['BACHS_SECRET_KEY', 'BACHS_WEBHOOK_SECRET']")),
  'CONTROL: a reconciliation that lists the webhook secret too is caught');
ok(!bindsOnlyBachsKey(goodReconcile.replace("secrets: ['BACHS_SECRET_KEY'], ", '')),
  'CONTROL: a reconciliation bound to nothing (it could never call Bachs) is caught');
const goodLifecycle = "export const passLifecycle = functions.pubsub.schedule('0 7 * * *').timeZone('Africa/Lagos').onRun(async () => null);";
ok(isScheduledOnly(goodLifecycle) && bindsNoBachsSecret(goodLifecycle), 'a scheduled job bound to no Bachs secret passes');
ok(!bindsNoBachsSecret(goodLifecycle.replace('functions.pubsub', "functions.runWith({ secrets: BACHS_SECRETS }).pubsub")),
  'CONTROL: a pass lifecycle that binds a Bachs secret it never reads is caught');
const goodPass = [
  "export const passLifecycle = functions.runWith({ timeoutSeconds: 300 }).pubsub.schedule('0 7 * * *').onRun(async () => {",
  "  for (const doc of passes.docs) {",
  "    const snap = doc.data();",
  "    if (!expirePass(snap, nowIso) && !reminderDue(snap, nowIso)) continue;",
  "    await db.runTransaction(async (t) => {",
  "      const a = (await t.get(doc.ref)).data();",
  "      const expired = expirePass(a, nowIso);",
  "      if (expired) { t.update(doc.ref, expired); return 1; }",
  "      const due = reminderDue(a, nowIso);",
  "      if (due) t.update(doc.ref, { pass_reminded: admin.firestore.FieldValue.arrayUnion(due) });",
  "    });",
  "  }",
  "});",
].join('\n');
ok(passLifecycleIsBounded(goodPass), 'a pass lifecycle that checks the snapshot, transacts only when due, and runs with 300s passes');
ok(!passLifecycleIsBounded(goodPass.replace("functions.runWith({ timeoutSeconds: 300 }).pubsub", 'functions.pubsub')),
  'CONTROL: a pass lifecycle on the default 60s timeout is caught');
ok(!passLifecycleIsBounded(goodPass.replace("    if (!expirePass(snap, nowIso) && !reminderDue(snap, nowIso)) continue;\n", '')),
  'CONTROL: a pass lifecycle that opens a transaction for every pass holder (no snapshot check first) is caught');
ok(!passLifecycleIsBounded(goodPass.replace("    if (!expirePass(snap, nowIso) && !reminderDue(snap, nowIso)) continue;\n", '    if (!expirePass(snap, nowIso)) continue;\n')),
  'CONTROL: a snapshot check that only looks for expiry (reminders would transact for everyone) is caught');
ok(!passLifecycleIsBounded(goodPass.replace("      const expired = expirePass(a, nowIso);\n      if (expired) { t.update(doc.ref, expired); return 1; }\n", '')),
  'CONTROL: a transaction that does not re-check the expiry on the fresh read is caught');
ok(!passLifecycleIsBounded(goodPass.replace('t.update(doc.ref, { pass_reminded', 'doc.ref.update({ pass_reminded')),
  'CONTROL: a reminder mark written outside the transaction is caught');
ok(!passLifecycleIsBounded(goodPass.replace("t.update(doc.ref, expired)", 'doc.ref.update(expired)')),
  'CONTROL: an expiry written outside the transaction is caught');
const goodDaily = [
  "export const billingDailyCheck = functions.pubsub.schedule('0 8 * * *').onRun(async () => {",
  "  const recon = await db.collection('payment_events').where('created_at', '>=', sinceTs).limit(5000).get();",
  "  const missed = recon.docs.filter((d) => d.data().source === 'reconcile');",
  "  const reviews = await db.collection('billing_reviews').where('created_at', '>=', sinceTs).limit(5000).get();",
  "});",
].join('\n');
ok(dailyCheckReadsItsWindow(goodDaily), 'a daily check that reads the 24h window by created_at passes');
ok(!dailyCheckReadsItsWindow(goodDaily.replace("db.collection('payment_events').where('created_at', '>=', sinceTs)", "db.collection('payment_events').where('source', '==', 'reconcile')")),
  'CONTROL: the old unordered source query on payment_events (and the composite index a range on it would need) is caught');
ok(!dailyCheckReadsItsWindow(goodDaily.replace("db.collection('billing_reviews').where('created_at', '>=', sinceTs).limit(5000)", "db.collection('billing_reviews').limit(500)")),
  'CONTROL: billing_reviews read with an unordered limit(500) is caught');
ok(!dailyCheckReadsItsWindow(goodDaily.replace("d.data().source === 'reconcile'", 'true')),
  'CONTROL: a daily check that no longer filters on source reconcile is caught');
const goodPaging = [
  "export const bachsReconcile = functions.runWith({ secrets: ['BACHS_SECRET_KEY'], timeoutSeconds: 300 }).pubsub.schedule('every 60 minutes').onRun(async () => {",
  "  const cursorRef = db.collection('platform_settings').doc('reconcile_cursor');",
  "  let after = (await cursorRef.get()).data()?.subscriptions_after ?? null; const co = 'checkouts_after';",
  "  const page = await base.orderBy(admin.firestore.FieldPath.documentId()).startAfter(after).limit(100).get();",
  "  for (const doc of page.docs) { if (Date.now() > deadline) return null; }",
  "});",
].join('\n');
ok(reconcilePagesByCursor(goodPaging), 'a reconciliation that pages by document id with a persisted cursor and a deadline passes');
ok(!reconcilePagesByCursor(goodPaging.replace("orderBy(admin.firestore.FieldPath.documentId()).startAfter(after).limit(100)", "limit(500)")),
  'CONTROL: the old fixed first-500 read (the same accounts never reconciled) is caught');
ok(!reconcilePagesByCursor(goodPaging.replace('.startAfter(after)', '')), 'CONTROL: a page read that never advances past the cursor is caught');
ok(!reconcilePagesByCursor(goodPaging.replace("doc('reconcile_cursor')", "doc('somewhere_else')")), 'CONTROL: a cursor that is not persisted is caught');
ok(!reconcilePagesByCursor(goodPaging.replace('subscriptions_after', 'x')), 'CONTROL: no cursor for the subscribers is caught');
ok(!reconcilePagesByCursor(goodPaging.replace("const co = 'checkouts_after';", '')), 'CONTROL: no cursor for the open checkouts is caught');
ok(!reconcilePagesByCursor(goodPaging.replace('Date.now() > deadline', 'false')), 'CONTROL: a sweep with no deadline (it would outrun the function timeout) is caught');
ok(reconcileWritesNoIdsAndNeverAlerts(goodPaging + "\n  const id = u.data().bachs_subscription_id;"), 'reading a subscription id is not writing one');
ok(!reconcileWritesNoIdsAndNeverAlerts(goodPaging + "\n  await userRef.set({ bachs_subscription_id: s.subscriptionId, bachs_customer_id: s.customerId }, { merge: true });"),
  'CONTROL: a reconciliation that pre-writes the subscription and customer ids is caught');
ok(!reconcileWritesNoIdsAndNeverAlerts(goodPaging + "\n  await userRef.set({ bachs_customer_id: x }, { merge: true });"),
  'CONTROL: a reconciliation that writes only the customer id is caught');
ok(!reconcileWritesNoIdsAndNeverAlerts(goodPaging + "\n  await userRef.set({ bachs_subscription_id }, { merge: true });"),
  'CONTROL: a shorthand id write is caught');
ok(!reconcileWritesNoIdsAndNeverAlerts(goodPaging + "\n  await billingAlertEmail('x', []);"), 'CONTROL: a reconciliation that alerts on its own (the helpers already do) is caught');
const goodLinked = "if (ref) { const out = await syncSubscriptionById(id, n, 'webhook'); await ref.update({ status: 'paid', settled_at: now }); res.status(200).send(out); }";
ok(syncsBeforeMarkingPaid(goodLinked), 'a branch that syncs and then marks the checkout paid passes');
ok(!syncsBeforeMarkingPaid("if (ref) { await ref.update({ status: 'paid', settled_at: now }); res.status(200).send(await syncSubscriptionById(id, n, 'webhook')); }"),
  'CONTROL: a branch that marks the checkout paid before the sync (the old webhook order) is caught');
ok(!syncsBeforeMarkingPaid("if (ref) { await ref.update({ status: 'paid', settled_at: now }); }"), 'CONTROL: a branch that never syncs is caught');
ok(!syncsBeforeMarkingPaid(''), 'CONTROL: a branch that cannot be found is not "in order"');
ok(between('a X b Y c', 'X', 'Y') === 'X b ' && between('a X b', 'X', 'Y') === '' && between('a b Y', 'X', 'Y') === '',
  'the branch cutter returns the text between two markers, and nothing when either is missing');

/* A ONE-OFF EVENT WITH NO READABLE AMOUNT IS LOOKED UP, NOT DECIDED (final review C1). The documented
   checkout.completed carries no top-level amount, and it can arrive before collection.succeeded. So the
   webhook's one_off_paid branch, when the amount or the currency is null, fetches the checkout session
   (stored bachs_checkout_id, else the event's) on the short webhook client, reads it with
   parseCheckoutSession — all BEFORE the grant helper — and when the lookup fails or still reads nothing
   it answers 200 'deferred' (the fetch is in a try/catch, so a Bachs failure is a deferral, not a 500). */
export const oneOffLooksUpUnreadAmount = (b: string): boolean => {
  const check = b.search(/if \(event\.amountMinor === null \|\| event\.currency === null\)/);
  const fetchAt = b.search(/bachs\(WEBHOOK_BACHS_TIMEOUT_MS\)\.getCheckoutSession\(/);
  const parse = b.indexOf('parseCheckoutSession(');
  const grant = b.indexOf('applyOneOffPayment(');
  return check >= 0 && fetchAt > check && parse > check && grant > fetchAt && grant > parse
    && /bachs_checkout_id/.test(b.slice(check, fetchAt))
    && /\bcatch\b/.test(b.slice(fetchAt, grant))
    && /res\.status\(200\)\.send\('deferred'\);\s*return;/.test(b.slice(check, grant));
};
console.log('\nA ONE-OFF WITH NO READABLE AMOUNT IS LOOKED UP:');
const oneOffBranch = between(exported(index, 'bachsWebhook'), "event.kind === 'one_off_paid'", "event.kind === 'subscription_linked'");
ok(oneOffLooksUpUnreadAmount(oneOffBranch),
  'the webhook fetches the checkout session for a one-off event with no readable amount, before the grant helper, and defers (200) when it still cannot read one');
const goodOneOff = [
  "if (event.kind === 'one_off_paid') {",
  "  let paid = event;",
  "  if (event.amountMinor === null || event.currency === null) {",
  "    const sessionId = String(stored?.bachs_checkout_id || event.checkoutId || '');",
  "    let s = null;",
  "    try { s = parseCheckoutSession(await bachs(WEBHOOK_BACHS_TIMEOUT_MS).getCheckoutSession(sessionId)); } catch (e) { console.error(e); }",
  "    if (!s || s.amountMinor === null) { res.status(200).send('deferred'); return; }",
  "    paid = { ...event, amountMinor: s.amountMinor, currency: s.currency };",
  "  }",
  "  res.status(200).send(await applyOneOffPayment(paid, 'webhook'));",
  "} else if (event.kind === 'subscription_linked') {",
].join('\n');
ok(oneOffLooksUpUnreadAmount(goodOneOff), 'a one-off branch that looks the amount up first passes');
ok(!oneOffLooksUpUnreadAmount("if (event.kind === 'one_off_paid') { res.status(200).send(await applyOneOffPayment(event, 'webhook')); }"),
  'CONTROL: a branch that hands an unreadable amount straight to the grant helper (the C1 bug) is caught');
ok(!oneOffLooksUpUnreadAmount(goodOneOff.replace('bachs(WEBHOOK_BACHS_TIMEOUT_MS)', 'bachs()')),
  'CONTROL: a lookup on the long-timeout client (it can outlast Bachs\' 10s window) is caught');
ok(!oneOffLooksUpUnreadAmount(goodOneOff.replace(' catch (e) { console.error(e); }', '')),
  'CONTROL: a lookup with no catch (a Bachs failure becomes a 500, not a deferral) is caught');
ok(!oneOffLooksUpUnreadAmount(goodOneOff.replace("res.status(200).send('deferred'); return;", "res.status(500).send('Retry'); return;")),
  'CONTROL: a lookup that still reads nothing and does not defer is caught');
ok(!oneOffLooksUpUnreadAmount(goodOneOff.replace("stored?.bachs_checkout_id || ", '')),
  'CONTROL: a lookup that ignores the stored session id is caught');

console.log(failures === 0
  ? '\nPASS — no signed-in user can grant themselves a plan, a token pack or a refill.'
  : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
