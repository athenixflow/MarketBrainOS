// Guards the Bachs payment rules (spec docs/superpowers/specs/2026-10-18-bachs-payments-design.md).
//
// Every rule that decides who gets paid value lives in functions/src/bachs/*.ts as a pure
// function, so it can be proved here without a Bachs account, a network or Firestore. The
// Firebase wrappers in index.ts only read, call these, and write what they return.
//
// Runs in `npm run build`. `npm run test:bachs` runs it alone.

import { DEFAULT_PRICING_CONFIG as CFG } from '../config/pricingConfig';
import { catalogItem, toMajorString, toMinor } from '../functions/src/bachs/catalog';
import { billingLive, productForTier, tierForProduct } from '../functions/src/bachs/config';
import { signPayload, verifyBachsSignature } from '../functions/src/bachs/signature';
import { parseBachsEvent, parseCheckoutSession, parseSubscription } from '../functions/src/bachs/events';
import { applyOneOff, checkoutAllowed, expirePass, reminderDue, syncSubscription, PASS_DAYS } from '../functions/src/bachs/grant';

let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

console.log('CATALOG:');
ok(catalogItem(CFG, 'plan', 'pro', 'USD')?.amountMinor === 1900, 'Pro plan is 1900 cents');
ok(catalogItem(CFG, 'plan', 'agency', 'USD')?.tokens === 2000, 'Agency plan carries its 2000-token allowance');
ok(catalogItem(CFG, 'plan', 'pro', 'NGN') === null, 'there is no naira subscription (Bachs cannot bill one)');
ok(catalogItem(CFG, 'pass', 'pro', 'NGN')?.amountMinor === 990000, 'Pro pass is 990000 kobo');
ok(catalogItem(CFG, 'pass', 'team', 'USD') === null, 'a pass is naira only');
ok(catalogItem(CFG, 'pass', 'enterprise', 'NGN') === null, 'Enterprise is not for sale');
ok(catalogItem(CFG, 'pass', 'free', 'NGN') === null, 'Free is not for sale');
ok(catalogItem(CFG, 'pack', 'starter', 'USD')?.amountMinor === 1000, 'Starter pack is 1000 cents');
ok(catalogItem(CFG, 'pack', 'starter', 'NGN')?.amountMinor === 500000, 'Starter pack is 500000 kobo');
ok(catalogItem(CFG, 'pack', 'growth', 'NGN')?.tokens === 500, 'a pack carries its token count');
ok(catalogItem(CFG, 'pack', 'nope', 'USD') === null, 'an unknown pack is not for sale');
ok(catalogItem(CFG, 'nope' as any, 'pro', 'USD') === null, 'an unknown kind is not for sale');

console.log('\nAMOUNTS:');
ok(toMajorString(1900) === '19.00' && toMajorString(990000) === '9900.00' && toMajorString(5) === '0.05', 'minor → Bachs decimal string');
ok(toMinor('19.00') === 1900 && toMinor('9900') === 990000 && toMinor('9900.5') === 990050, 'exact strings parse to minor units');
ok(toMinor(19) === 1900, 'a number is read as major units');
ok(toMinor(19.99) === 1999, 'a number with two decimals is exact (float noise accepted)');
ok(toMinor(19.999) === null && toMinor(1.005) === null, 'a number with three decimals goes to review, never rounded');
ok(toMinor(-1) === null && toMinor(NaN) === null && toMinor(Infinity) === null, 'a negative, NaN or infinite number is not an amount');
ok(toMinor('9,900.00') === null && toMinor('-5.00') === null && toMinor('1.234') === null && toMinor(undefined) === null,
  'commas, negatives, three decimals and missing values parse to null (review, never a guess)');
let threw = false; try { toMajorString(19.5); } catch { threw = true; }
ok(threw, 'a non-integer minor amount is refused, not rounded');

console.log('\nSWITCH AND PRODUCTS:');
const env = { BACHS_SECRET_KEY: 'sk_sandbox_x', BILLING_LIVE: 'true', BACHS_PRODUCT_PRO: 'prod_p', BACHS_PRODUCT_TEAM: 'prod_t', BACHS_PRODUCT_AGENCY: 'prod_a' };
ok(billingLive(env) === true, 'key + flag = live');
ok(billingLive({ ...env, BACHS_SECRET_KEY: '' }) === false, 'no key = not live, whatever the flag says');
ok(billingLive({ ...env, BILLING_LIVE: 'yes' }) === false, 'only the exact string "true" switches it on');
ok(productForTier('team', env) === 'prod_t' && tierForProduct('prod_a', env) === 'agency', 'tier ↔ product both ways');
ok(tierForProduct('prod_unknown', env) === null && tierForProduct(null, env) === null, 'an unknown product grants no tier');

console.log('\nSIGNATURE:');
const SECRET = 'whsec_test';
const BODY = '{"id":"evt_1","type":"collection.succeeded","data":{"amount":"19.00"}}';
const NOW = 1_760_000_000;
const header = (t: number | string, ...sigs: string[]) => `t=${t},${sigs.map((s) => `v1=${s}`).join(',')}`;
const good = signPayload(SECRET, String(NOW), BODY);
ok(verifyBachsSignature(BODY, header(NOW, good), SECRET, NOW), 'a correct signature verifies');
ok(verifyBachsSignature(Buffer.from(BODY), header(NOW, good), SECRET, NOW), 'raw bytes verify the same as the string');
ok(!verifyBachsSignature(BODY.replace('19.00', '1.00'), header(NOW, good), SECRET, NOW), 'a tampered body fails');
ok(!verifyBachsSignature(BODY, header(NOW, good), 'whsec_other', NOW), 'the wrong secret fails');
ok(!verifyBachsSignature(BODY, header(NOW, good), SECRET, NOW + 301), 'a signature older than 300s fails (replay)');
ok(!verifyBachsSignature(BODY, header(NOW, good), SECRET, NOW - 301), 'a signature from the future fails');
ok(!verifyBachsSignature(BODY, undefined, SECRET, NOW) && !verifyBachsSignature(BODY, header(NOW, good), undefined, NOW),
  'a missing header or a missing secret fails closed');
ok(verifyBachsSignature(BODY, header(NOW, 'ab'.repeat(32), good), SECRET, NOW), 'during rotation any one valid v1 verifies');
const msT = NOW * 1000;
ok(verifyBachsSignature(BODY, header(msT, signPayload(SECRET, String(msT), BODY)), SECRET, NOW),
  'a millisecond timestamp is accepted when fresh (Review Focus 1)');
ok(!verifyBachsSignature(BODY, header(msT, signPayload(SECRET, String(msT), BODY)), SECRET, NOW + 400),
  'and rejected when stale');
ok(!verifyBachsSignature(BODY, 'garbage', SECRET, NOW) && !verifyBachsSignature(BODY, `t=${NOW}`, SECRET, NOW), 'a malformed header fails');

console.log('\nEVENTS:');
const ev = (type: string, data: Record<string, unknown>) => ({ id: 'evt_1', type, created_at: '2026-10-20T10:00:00Z', data });
const paid = parseBachsEvent(ev('collection.succeeded', { reference: 'mb_1', status: 'SUCCEEDED', amount: '9900.00', currency: 'ngn', metadata: { uid: 'u1' }, checkout_id: 'chk_1' }));
ok(paid?.kind === 'one_off_paid' && paid.amountMinor === 990000 && paid.currency === 'NGN' && paid.metadata.uid === 'u1' && paid.checkoutId === 'chk_1',
  'collection.succeeded becomes a one-off payment, amount in kobo, currency upper-cased');
ok(parseBachsEvent(ev('collection.succeeded', { status: 'SUCCEEDED', amount: '19.00' })) === null,
  'a collection with no reference (a renewal) is left to invoice.paid');
ok(parseBachsEvent(ev('collection.succeeded', { reference: 'mb_1', status: 'FAILED', amount: '1.00' })) === null, 'a failed collection grants nothing');
ok(parseBachsEvent(ev('checkout.completed', { id: 'chk_2', mode: 'payment', payment_status: 'paid', reference: 'mb_2', amount: '10.00', currency: 'USD' }))?.kind === 'one_off_paid',
  'a paid one-off checkout is a one-off payment');
const linked = parseBachsEvent(ev('checkout.completed', { id: 'chk_3', mode: 'subscription', payment_status: 'paid', reference: 'mb_3', subscription: { id: 'sub_9' }, customer: { id: 'cust_4' } }));
ok(linked?.kind === 'subscription_linked' && linked.subscriptionId === 'sub_9' && linked.customerId === 'cust_4',
  'a subscription checkout only links ids (the period grant comes from the subscription)');
ok(parseBachsEvent(ev('invoice.paid', { subscription: 'sub_9', amount_paid: '19.00' }))?.kind === 'subscription_changed', 'invoice.paid → sync the subscription');
ok(parseBachsEvent(ev('customer.subscription.deleted', { id: 'sub_9', status: 'canceled' }))?.subscriptionId === 'sub_9', 'a subscription event carries its own id');
ok(parseBachsEvent(ev('dispute.created', { charge_id: 'ch_1' }))?.kind === 'review', 'a dispute goes to review');
ok(parseBachsEvent(ev('payout.paid', {})) === null && parseBachsEvent({}) === null && parseBachsEvent(null) === null && parseBachsEvent('x') === null,
  'unknown and malformed events parse to null, never throw');

const sub = parseSubscription({ id: 'sub_9', status: 'ACTIVE', product_id: 'prod_p', customer: { id: 'cust_4' }, currency: 'usd', amount: '19.00',
  current_period_start: '2026-10-01T00:00:00Z', current_period_end: '2026-11-01T00:00:00Z', cancel_at_period_end: true, metadata: { uid: 'u1' } });
ok(sub?.status === 'active' && sub.productId === 'prod_p' && sub.amountMinor === 1900 && sub.cancelAtPeriodEnd && sub.metadata.uid === 'u1',
  'a subscription parses: status lower-cased, amount in cents, cancel flag, metadata');
ok(parseSubscription({ data: { id: 'sub_9', status: 'active' } })?.id === 'sub_9', 'a { data } envelope is unwrapped');
ok(parseSubscription({ status: 'active' }) === null, 'no id → null');
const chk = parseCheckoutSession({ checkout_id: 'chk_1', reference: 'mb_1', status: 'completed', payment_status: 'paid', amount: '9900.00', currency: 'NGN' });
ok(chk?.paid === true && chk.amountMinor === 990000 && chk.reference === 'mb_1', 'a paid checkout session parses');
ok(parseCheckoutSession({ id: 'chk_1', status: 'expired' })?.expired === true, 'an expired session parses');

console.log('\nHOSTILE INPUT:');
const THREW = 'THREW' as const;
const attempt = <T>(f: () => T): T | typeof THREW => { try { return f(); } catch { return THREW; } };
const objMeta = { a: { toString: 1 } };
const objStatus = { toString: 1 };
const hostileEvent = attempt(() => parseBachsEvent(ev('collection.succeeded', { reference: 'mb_1', status: 'SUCCEEDED', amount: '19.00', metadata: objMeta })));
ok(hostileEvent !== THREW, 'an object metadata value on an event does not throw', 'it threw');
ok(hostileEvent !== THREW && hostileEvent?.metadata.a === undefined, 'an object metadata value is dropped, not stringified');
const hostileSub = attempt(() => parseSubscription({ id: 'sub_9', status: 'active', metadata: objMeta }));
ok(hostileSub !== THREW, 'an object metadata value on a subscription does not throw', 'it threw');
const nullMeta = parseBachsEvent(ev('collection.succeeded', { reference: 'mb_1', status: 'SUCCEEDED', amount: '19.00', metadata: { uid: null, n: 3, t: true } }));
ok(nullMeta !== null && !('uid' in nullMeta.metadata) && nullMeta.metadata.n === '3' && nullMeta.metadata.t === 'true',
  'null metadata is dropped; numbers and booleans are kept as strings');
const objStatusEvent = attempt(() => parseBachsEvent(ev('collection.succeeded', { reference: 'mb_1', status: objStatus, amount: '19.00' })));
ok(objStatusEvent !== THREW, 'an object status on a collection does not throw', 'it threw');
ok(objStatusEvent === null, 'an object status on a collection grants nothing');
const objStatusSub = attempt(() => parseSubscription({ id: 'sub_9', status: objStatus }));
ok(objStatusSub !== THREW, 'an object status on a subscription does not throw', 'it threw');
const objStatusChk = attempt(() => parseCheckoutSession({ id: 'chk_1', status: objStatus }));
ok(objStatusChk !== THREW && objStatusChk?.paid === false, 'an object status on a checkout does not throw and is not paid', 'it threw or parsed as paid');

console.log('\nCHECKOUT PAYMENT STATE:');
ok(parseCheckoutSession({ id: 'chk_5', status: 'completed', payment_status: 'unpaid', amount: '9900.00' })?.paid === false, 'a completed session with payment_status unpaid is not paid');
ok(parseCheckoutSession({ id: 'chk_6', status: 'completed', payment_status: 'failed' })?.paid === false, 'a completed session with payment_status failed is not paid');
ok(parseCheckoutSession({ id: 'chk_7', status: 'completed' })?.paid === true, 'with no payment_status, a completed session still reads as paid');

console.log('\nONE-OFF GRANTS:');
const T0 = '2026-10-20T10:00:00.000Z';
const day = (n: number) => new Date(Date.parse(T0) + n * 86_400_000).toISOString();
const free = { tier: 'free', monthly_tokens: 0, purchased_tokens: 7 };
const proPass = (expires: string) => ({ tier: 'pro', billing_mode: 'pass' as const, pass_expires_at: expires, monthly_tokens: 50, purchased_tokens: 7, subscription_status: 'active' });
const usdSub = { tier: 'team', billing_mode: 'subscription' as const, subscription_status: 'active', bachs_subscription_id: 'sub_1', monthly_tokens: 10, purchased_tokens: 0 };
const checkout = (kind: any, item: string, currency: any, amount: number) => ({ uid: 'u1', kind, item, currency, amount_minor: amount, status: 'open' });
const pay = (amount: number | null, currency = 'NGN') => ({ reference: 'mb_1', amountMinor: amount, currency });

const first = applyOneOff(free, checkout('pass', 'pro', 'NGN', 990000), pay(990000), CFG, T0);
ok(first.ledgerKey === 'checkout:mb_1' && first.review === null && first.checkoutStatus === 'paid', 'a matching pass payment is granted, keyed by its checkout');
ok(first.userUpdate?.tier === 'pro' && first.userUpdate?.billing_mode === 'pass' && first.userUpdate?.pass_expires_at === day(PASS_DAYS),
  'a first pass gives Pro for 30 days');
ok(first.userUpdate?.monthly_tokens === 300 && first.userUpdate?.purchased_tokens === 7, 'with a fresh 300 allowance, purchased tokens kept');
ok(first.payment?.amount_minor === 990000 && first.payment?.currency === 'NGN', 'the payment record is in kobo, as charged');

const early = applyOneOff(proPass(day(5)), checkout('pass', 'pro', 'NGN', 990000), pay(990000), CFG, T0);
ok(early.userUpdate?.pass_expires_at === day(35), 'renewing the same tier with 5 days left gives 35 days');
ok(early.userUpdate?.monthly_tokens === 350 && early.userUpdate?.purchased_tokens === 7,
  'an early renewal ADDS the new 300 allowance to the 50 left (350), so no paid token is thrown away');
const twoTabs = applyOneOff(proPass(day(30)), checkout('pass', 'pro', 'NGN', 990000), pay(990000), CFG, T0);
ok(twoTabs.userUpdate?.pass_expires_at === day(60), 'two payments for the same pass stack to 60 days (Review Focus 5)');
ok(twoTabs.userUpdate?.monthly_tokens === 350, 'two payments for the same pass stack their allowances too (50 + 300), not one month of tokens for two');
const up = applyOneOff(proPass(day(20)), checkout('pass', 'team', 'NGN', 3900000), pay(3900000), CFG, T0);
ok(up.userUpdate?.tier === 'team' && up.userUpdate?.pass_expires_at === day(30), 'an upgrade mid-pass starts a fresh 30 days of the new tier');
ok(up.userUpdate?.monthly_tokens === 600, 'an upgrade starts a fresh allowance of exactly the new tier (the old 50 is not carried over)');
const down = applyOneOff({ ...proPass(day(20)), tier: 'agency' }, checkout('pass', 'pro', 'NGN', 990000), pay(990000), CFG, T0);
ok(down.review !== null && down.userUpdate === null && down.ledgerKey === 'checkout:mb_1', 'a lower pass paid during a higher one goes to review, recorded once');
ok(applyOneOff(usdSub, checkout('pass', 'pro', 'NGN', 990000), pay(990000), CFG, T0).review !== null, 'a pass paid on top of a USD subscription goes to review');

const lateExpired = applyOneOff(free, { ...checkout('pass', 'pro', 'NGN', 990000), status: 'expired' }, pay(990000), CFG, T0);
ok(lateExpired.review === null && lateExpired.userUpdate?.tier === 'pro', 'a payment on a checkout we marked expired is still granted (Review Focus 4)');

const pack = applyOneOff({ tier: 'pro', monthly_tokens: 40, purchased_tokens: 10 }, checkout('pack', 'starter', 'USD', 1000), pay(1000, 'USD'), CFG, T0);
ok(pack.userUpdate?.purchased_tokens === 110 && pack.userUpdate?.monthly_tokens === 40 && pack.userUpdate?.tier === undefined,
  'a pack adds to purchased tokens and touches nothing else');

ok(applyOneOff(free, checkout('pass', 'pro', 'NGN', 990000), pay(100), CFG, T0).review !== null, 'an amount mismatch goes to review');
ok(applyOneOff(free, checkout('pass', 'pro', 'NGN', 990000), pay(990000, 'USD'), CFG, T0).review !== null, 'a currency mismatch goes to review');
ok(applyOneOff(free, checkout('pass', 'pro', 'NGN', 990000), pay(null), CFG, T0).review !== null, 'an unparseable amount goes to review (Review Focus 2)');
ok(applyOneOff(free, null, pay(990000), CFG, T0).review !== null, 'a reference we never issued goes to review');
const gone = applyOneOff(null, checkout('pass', 'pro', 'NGN', 990000), pay(990000), CFG, T0);
ok(gone.review !== null && gone.userUpdate === null && gone.ledgerKey !== null, 'a deleted account is reviewed and recorded, not retried (Review Focus 3)');
ok(applyOneOff(free, checkout('plan', 'pro', 'USD', 1900), pay(1900, 'USD'), CFG, T0).ledgerKey === null,
  'a subscription checkout grants nothing here (the subscription sync does)');
ok(applyOneOff(free, checkout('pass', 'pro', 'NGN', 990000), { reference: null, amountMinor: 990000, currency: 'NGN' }, CFG, T0).ledgerKey === null,
  'no reference → nothing to do');

console.log('\nCHECKOUT ELIGIBILITY:');
ok(!checkoutAllowed(free, 'pack', 'starter', T0).ok, 'a free account cannot buy a pack');
ok(checkoutAllowed({ tier: 'pro' }, 'pack', 'starter', T0).ok, 'a paid account can');
ok(!checkoutAllowed({ ...proPass(day(10)), tier: 'agency' }, 'pass', 'pro', T0).ok, 'a lower pass is refused while a higher one is active');
ok(checkoutAllowed(proPass(day(10)), 'pass', 'pro', T0).ok && checkoutAllowed(proPass(day(10)), 'pass', 'team', T0).ok, 'same or higher pass is allowed');
ok(!checkoutAllowed(proPass(day(10)), 'plan', 'pro', T0).ok, 'a USD plan is refused while a naira pass is active');
ok(!checkoutAllowed(usdSub, 'plan', 'agency', T0).ok && !checkoutAllowed(usdSub, 'pass', 'pro', T0).ok,
  'with a live USD subscription: no second subscription, no pass');
ok(checkoutAllowed({ tier: 'pro' }, 'plan', 'pro', T0).ok, 'an admin-granted plan does not block buying');
/* TIER_RANK is a plain object: 'constructor' / '__proto__' must rank as unknown (0), not as an inherited function/object. */
const protoProbe = attempt(() => checkoutAllowed({ tier: 'pro' }, 'pass', 'constructor', T0));
ok(protoProbe !== THREW && typeof protoProbe === 'object' && protoProbe !== null && 'ok' in protoProbe,
  "an inherited key as the item ('constructor') does not throw and still yields a verdict");
ok(attempt(() => !checkoutAllowed(proPass(day(10)), 'pass', 'constructor', T0).ok) === true,
  "an inherited key ('constructor') ranks as unknown (0), so it is below an active Pro pass and refused");
ok(attempt(() => !checkoutAllowed(proPass(day(10)), 'pass', '__proto__', T0).ok) === true,
  "an inherited key ('__proto__') ranks as unknown (0), so it is below an active Pro pass and refused");

console.log('\nPASS LIFECYCLE:');
ok(reminderDue(proPass(day(4.5)), T0) === 5 && reminderDue({ ...proPass(day(4.5)), pass_reminded: [5] }, T0) === null, '5-day reminder once');
ok(reminderDue({ ...proPass(day(0.5)), pass_reminded: [5] }, T0) === 1, '1-day reminder');
ok(reminderDue({ ...proPass(day(0.5)), pass_reminded: [1] }, T0) === null, 'with ≤1 day left and the 1-day reminder sent, no 5-day reminder goes out (a missed cron run)');
ok(reminderDue(proPass(day(0.5)), T0) === 1, 'with ≤1 day left and nothing sent, only the 1-day reminder is due');
ok(reminderDue(proPass(day(10)), T0) === null && reminderDue(usdSub, T0) === null, 'no reminder early, or for a subscription');
const exp = expirePass(proPass(day(-0.1)), T0);
ok(exp?.tier === 'free' && exp?.monthly_tokens === 0 && exp?.purchased_tokens === 7 && exp?.subscription_status === 'expired',
  'an ended pass → Free, allowance 0, purchased tokens kept');
ok(expirePass(proPass(day(1)), T0) === null && expirePass(usdSub, T0) === null, 'an active pass or a subscription is not expired');
ok(expirePass({ ...usdSub, pass_expires_at: day(-0.1) }, T0) === null, 'a USD subscriber with a leftover expired pass date is NOT dropped to Free');
ok(reminderDue({ ...usdSub, pass_expires_at: day(0.5) }, T0) === null, 'a USD subscriber with a leftover pass date gets no pass reminder');

console.log('\nSUBSCRIPTION SYNC:');
const snap = (over: Record<string, unknown> = {}) => ({
  id: 'sub_1', status: 'active', productId: 'prod_p', customerId: 'cust_1', currency: 'USD', amountMinor: 1900,
  currentPeriodStart: '2026-10-01T00:00:00Z', currentPeriodEnd: '2026-11-01T00:00:00Z', cancelAtPeriodEnd: false, metadata: { uid: 'u1' }, ...over,
});
const s1 = syncSubscription({ tier: 'free', purchased_tokens: 3 }, snap() as any, 'pro', CFG, 1900);
ok(s1.grant.ledgerKey === 'period:sub_1:2026-10-01T00:00:00Z:prod_p' && s1.grant.userUpdate?.tier === 'pro'
  && s1.grant.userUpdate?.monthly_tokens === 300 && s1.grant.userUpdate?.purchased_tokens === 3, 'an active paid period grants Pro + 300, keyed by period and product');
ok(s1.stateUpdate.subscription_status === 'active' && s1.stateUpdate.plan_renews_at === '2026-11-01T00:00:00Z' && s1.stateUpdate.bachs_subscription_id === 'sub_1',
  'and the always-applied state carries status, renewal date and ids');
ok(s1.grant.payment?.amount_minor === 1900 && s1.grant.payment.currency === 'USD', 'payment recorded as charged');
const renew = syncSubscription({ tier: 'pro' }, snap({ currentPeriodStart: '2026-11-01T00:00:00Z' }) as any, 'pro', CFG, 1900);
ok(renew.grant.ledgerKey === 'period:sub_1:2026-11-01T00:00:00Z:prod_p', 'a new period is a new key (the renewal grants once)');
const upgraded = syncSubscription({ tier: 'pro' }, snap({ productId: 'prod_t', amountMinor: 7900 }) as any, 'team', CFG, 6000);
ok(upgraded.grant.ledgerKey?.endsWith(':prod_t') === true && upgraded.grant.userUpdate?.tier === 'team' && upgraded.grant.payment?.amount_minor === 6000,
  'an upgrade in the same period is a new key; the prorated charge is recorded as charged');
const recon = syncSubscription({ tier: 'pro' }, snap() as any, 'pro', CFG, null);
ok(recon.grant.payment?.amount_minor === 1900, 'reconciliation without an invoice records the plan price');
const cancelling = syncSubscription({ tier: 'pro' }, snap({ cancelAtPeriodEnd: true }) as any, 'pro', CFG, null);
ok(cancelling.stateUpdate.subscription_status === 'cancelled', 'cancel at period end → cancelled, access kept');
const pastDue = syncSubscription({ tier: 'pro' }, snap({ status: 'past_due' }) as any, 'pro', CFG, null);
ok(pastDue.stateUpdate.subscription_status === 'past_due' && pastDue.grant.ledgerKey === null, 'past due changes status only');
const ended = syncSubscription({ tier: 'pro', purchased_tokens: 9, bachs_subscription_id: 'sub_1' }, snap({ status: 'canceled' }) as any, 'pro', CFG, null);
ok(ended.grant.ledgerKey === 'end:sub_1' && ended.grant.userUpdate?.tier === 'free' && ended.grant.userUpdate?.monthly_tokens === 0
  && ended.grant.userUpdate?.purchased_tokens === 9 && ended.grant.userUpdate?.billing_mode === null, 'ended → Free once, purchased tokens kept');
const unpaid = syncSubscription({ tier: 'pro', bachs_subscription_id: 'sub_1' }, snap({ status: 'unpaid' }) as any, 'pro', CFG, null);
ok(unpaid.grant.ledgerKey === 'end:sub_1' && unpaid.grant.userUpdate?.tier === 'free', 'unpaid ends it too');
ok(syncSubscription({}, snap() as any, null, CFG, 1900).grant.review !== null, 'an unknown product goes to review');
ok(syncSubscription({}, snap({ amountMinor: 100 }) as any, 'pro', CFG, 100).grant.review !== null, 'a product billing the wrong amount goes to review');
ok(syncSubscription({}, snap({ status: 'trialing' }) as any, 'pro', CFG, null).grant.ledgerKey === null, 'a trial grants nothing (trials are not sold)');
ok(s1.grant.review === null && !('pass_expires_at' in (s1.grant.userUpdate ?? {})), 'with no pass in the way a period grants cleanly: no review, no pass fields touched');

/* Two checkouts opened in two tabs: a naira pass is paid, then a USD subscription activates while it runs. */
const overlapPass = { tier: 'pro', billing_mode: 'pass' as const, pass_expires_at: '2026-10-20T00:00:00.000Z', pass_reminded: [5], monthly_tokens: 50, purchased_tokens: 7, subscription_status: 'active' };
const overlap = syncSubscription(overlapPass, snap({ productId: 'prod_t', amountMinor: 7900 }) as any, 'team', CFG, 7900);
ok(overlap.grant.userUpdate?.tier === 'team' && overlap.grant.userUpdate?.billing_mode === 'subscription' && overlap.grant.payment?.amount_minor === 7900,
  'a USD period activating over a live pass is still granted (the customer paid for it)');
ok(overlap.grant.userUpdate?.pass_expires_at === null && Array.isArray(overlap.grant.userUpdate?.pass_reminded) && (overlap.grant.userUpdate?.pass_reminded as unknown[]).length === 0,
  'and the pass fields are cleared so the pass-expiry job cannot later drop the subscriber to Free');
ok(overlap.grant.review !== null && overlap.grant.review.includes('2026-10-20T00:00:00.000Z') && /pass/i.test(overlap.grant.review),
  'and it is flagged for review, naming the overlapping pass and its expiry, so the unused pass days can be refunded');
ok(overlap.grant.userUpdate?.purchased_tokens === 7 && overlap.grant.ledgerKey === 'period:sub_1:2026-10-01T00:00:00Z:prod_t',
  'purchased tokens survive, and the ledger key is unchanged by the overlap');
const lateSync = syncSubscription({ ...overlapPass, pass_expires_at: '2026-10-10T00:00:00.000Z' }, snap() as any, 'pro', CFG, 1900);
ok(lateSync.grant.review !== null, 'liveness is judged at the period start, not the clock: a pass live on 1 Oct is an overlap however late the sync runs');
const lapsed = syncSubscription({ ...overlapPass, pass_expires_at: '2026-09-20T00:00:00.000Z' }, snap() as any, 'pro', CFG, 1900);
ok(lapsed.grant.review === null && !('pass_expires_at' in (lapsed.grant.userUpdate ?? {})), 'a pass that ended before the period started is not an overlap');
ok(syncSubscription({ ...usdSub, pass_expires_at: '2099-01-01T00:00:00.000Z' }, snap() as any, 'pro', CFG, 1900).grant.review === null,
  'a subscriber with a leftover pass date (not a live pass) renews without a review');

/* An active snapshot with no readable period start cannot be keyed: a shared `…:null:…` key would
   be consumed by the first sync and make every renewal look already-granted. It is reviewed, not granted. */
const noStartAcct = { ...overlapPass, pass_expires_at: '2099-01-01T00:00:00.000Z' };
const noStart = syncSubscription(noStartAcct, snap({ currentPeriodStart: null }) as any, 'pro', CFG, 1900);
ok(noStart.grant.review === 'active subscription with no readable period start' && noStart.grant.userUpdate === null && noStart.grant.payment === null,
  'an active subscription with no period start is reviewed, not granted (no userUpdate, no payment)');
ok(noStart.grant.ledgerKey === 'period:sub_1:nostart:prod_p' && !('subscription_status' in noStart.stateUpdate) && !('plan_renews_at' in noStart.stateUpdate)
  && noStart.stateUpdate.bachs_subscription_id === 'sub_1', 'it is keyed apart from any real period, and only the ids are stored (no status or renewal change)');
ok(JSON.stringify(syncSubscription(noStartAcct, snap({ currentPeriodStart: null }) as any, 'pro', CFG, 1900)) === JSON.stringify(noStart),
  'and the result does not depend on the clock: the same input gives the same output');
const badStart = syncSubscription(noStartAcct, snap({ currentPeriodStart: 'not a date' }) as any, 'pro', CFG, 1900);
ok(badStart.grant.userUpdate === null && badStart.grant.review !== null, 'an unparseable period start is treated the same way');
const afterNoStart = syncSubscription({ tier: 'free', bachs_subscription_id: 'sub_1' }, snap() as any, 'pro', CFG, 1900);
ok(afterNoStart.grant.userUpdate?.tier === 'pro' && afterNoStart.grant.review === null, 'once Bachs sends a real period start the subscription grants normally');

/* The sync must only act on the account's CURRENT subscription. */
const liveSub = { tier: 'pro', billing_mode: 'subscription' as const, subscription_status: 'active', bachs_subscription_id: 'sub_1', monthly_tokens: 200, purchased_tokens: 9 };
const endOther = syncSubscription({ ...liveSub, bachs_subscription_id: 'sub_2' }, snap({ status: 'canceled' }) as any, 'pro', CFG, null);
ok(endOther.grant.userUpdate === null && Object.keys(endOther.stateUpdate).length === 0 && endOther.grant.review !== null && endOther.grant.ledgerKey === 'end:sub_1',
  'a subscription that ends but is not the account\'s current one leaves the account unchanged and is reviewed (once)');
const endCurrent = syncSubscription(liveSub, snap({ status: 'canceled' }) as any, 'pro', CFG, null);
ok(endCurrent.grant.userUpdate?.tier === 'free' && endCurrent.grant.review === null && endCurrent.grant.userUpdate?.bachs_subscription_id === null,
  'the account\'s own subscription ending still drops it to Free');
const endOnPass = syncSubscription(proPass(day(10)), snap({ status: 'canceled' }) as any, 'pro', CFG, null);
ok(endOnPass.grant.userUpdate === null && endOnPass.grant.review !== null,
  'a subscription that ended while the account holds a pass and stores no subscription id does not drop the pass holder to Free');
const second = syncSubscription({ ...liveSub, bachs_subscription_id: 'sub_0' }, snap({ id: 'sub_2' }) as any, 'pro', CFG, 1900);
ok(second.grant.userUpdate?.tier === 'pro' && second.grant.payment !== null && second.grant.review !== null
  && second.grant.review.includes('sub_0') && second.grant.review.includes('sub_2'),
  'a second live subscription is still granted (the customer paid) and flagged, naming both ids, so one can be refunded');
ok(syncSubscription(liveSub, snap({ currentPeriodStart: '2026-11-01T00:00:00Z' }) as any, 'pro', CFG, 1900).grant.review === null,
  'renewing the account\'s own subscription is not flagged');

/* A second subscription never re-points "current": the first stays current, deterministically. */
ok(Object.keys(second.stateUpdate).length === 0, 'a second subscription writes no state (no ids, status or renewal date)');
let acct: any = { ...liveSub };
const stateOf2: Record<string, unknown>[] = [];
for (const id of ['sub_1', 'sub_2', 'sub_1', 'sub_2']) {
  const r = syncSubscription(acct, snap({ id }) as any, 'pro', CFG, 1900);
  if (id === 'sub_2') stateOf2.push(r.stateUpdate);
  acct = { ...acct, ...r.stateUpdate };
}
ok(acct.bachs_subscription_id === 'sub_1' && stateOf2.every((s) => Object.keys(s).length === 0),
  'syncing sub_1 and sub_2 alternately leaves the stored id on sub_1 every time (sub_2\'s state is always empty)');
const pastDue2 = syncSubscription(liveSub, snap({ id: 'sub_2', status: 'past_due' }) as any, 'pro', CFG, null);
ok(Object.keys(pastDue2.stateUpdate).length === 0 && pastDue2.grant.ledgerKey === null, 'a non-current subscription going past due changes nothing on the account');
const trial2 = syncSubscription(liveSub, snap({ id: 'sub_2', status: 'trialing' }) as any, 'pro', CFG, null);
ok(Object.keys(trial2.stateUpdate).length === 0, 'nor does any other status update from a non-current subscription');
const end2 = syncSubscription(acct, snap({ id: 'sub_2', status: 'canceled' }) as any, 'pro', CFG, null);
ok(end2.grant.userUpdate === null && Object.keys(end2.stateUpdate).length === 0 && end2.grant.review !== null && acct.bachs_subscription_id === 'sub_1',
  'so ending sub_2 afterwards leaves the account on sub_1 unchanged, with a review');
const end1 = syncSubscription(acct, snap({ id: 'sub_1', status: 'canceled' }) as any, 'pro', CFG, null);
ok(end1.grant.userUpdate?.tier === 'free', 'and ending sub_1 (the current one) downgrades');
const noId = syncSubscription({ tier: 'free' }, snap({ id: 'sub_2' }) as any, 'pro', CFG, 1900);
ok(noId.stateUpdate.bachs_subscription_id === 'sub_2' && noId.stateUpdate.subscription_status === 'active', 'an account with no stored subscription id adopts the first one it sees');

/* The payment record says whether its amount was charged or is only the list price. */
ok(s1.grant.payment?.amount_source === 'invoice' && upgraded.grant.payment?.amount_source === 'invoice', 'a payment recorded from an invoice says so');
ok(recon.grant.payment?.amount_source === 'plan_price', 'a payment recorded without an invoice says it is the plan price');

console.log(failures === 0
  ? '\nPASS — Bachs: amounts, signatures, events and every grant rule behave.'
  : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
