// Guards the Bachs payment rules (spec docs/superpowers/specs/2026-10-18-bachs-payments-design.md).
//
// Every rule that decides who gets paid value lives in functions/src/bachs/*.ts as a pure
// function, so it can be proved here without a Bachs account, a network or Firestore. The
// Firebase wrappers in index.ts only read, call these, and write what they return.
//
// Runs in `npm run build`. `npm run test:bachs` runs it alone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PRICING_CONFIG as CFG } from '../config/pricingConfig';
import { catalogItem, toMajorString, toMinor } from '../functions/src/bachs/catalog';
import { billingLive, productForTier, tierForProduct } from '../functions/src/bachs/config';
import { signPayload, verifyBachsSignature } from '../functions/src/bachs/signature';
import { parseBachsEvent, parseCheckoutSession, parseSubscription } from '../functions/src/bachs/events';
import { applyOneOff, checkoutAllowed, expirePass, invoicePayment, manageOwnership, reminderDue, syncSubscription, PASS_DAYS } from '../functions/src/bachs/grant';
import { bachsApi, bachsBaseUrl, BachsApiError } from '../functions/src/bachs/api';
import { EMAIL_TEMPLATES, MARKETING_KEYS } from '../functions/src/email/templates';

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
const unread = applyOneOff(free, checkout('pass', 'pro', 'NGN', 990000), pay(null), CFG, T0);
ok(unread.review === null && unread.ledgerKey === null && typeof unread.deferred === 'string',
  'an unparseable amount decides nothing: deferred, no review and no ledger key (the event that carries the amount settles it)');
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
const s1 = syncSubscription({ tier: 'free', purchased_tokens: 3 }, snap() as any, 'pro', CFG);
ok(s1.grant.ledgerKey === 'period:sub_1:2026-10-01T00:00:00Z:prod_p' && s1.grant.userUpdate?.tier === 'pro'
  && s1.grant.userUpdate?.monthly_tokens === 300 && s1.grant.userUpdate?.purchased_tokens === 3, 'an active paid period grants Pro + 300, keyed by period and product');
ok(s1.stateUpdate.subscription_status === 'active' && s1.stateUpdate.plan_renews_at === '2026-11-01T00:00:00Z' && s1.stateUpdate.bachs_subscription_id === 'sub_1',
  'and the always-applied state carries status, renewal date and ids');
ok(s1.grant.payment === null, 'a period grant records no payment (only a paid invoice is a payment: final review I6)');
const renew = syncSubscription({ tier: 'pro' }, snap({ currentPeriodStart: '2026-11-01T00:00:00Z' }) as any, 'pro', CFG);
ok(renew.grant.ledgerKey === 'period:sub_1:2026-11-01T00:00:00Z:prod_p', 'a new period is a new key (the renewal grants once)');
const upgraded = syncSubscription({ tier: 'pro' }, snap({ productId: 'prod_t', amountMinor: 7900 }) as any, 'team', CFG);
ok(upgraded.grant.ledgerKey?.endsWith(':prod_t') === true && upgraded.grant.userUpdate?.tier === 'team',
  'an upgrade in the same period is a new key');
const recon = syncSubscription({ tier: 'pro' }, snap() as any, 'pro', CFG);
ok(recon.grant.userUpdate?.tier === 'pro' && recon.grant.payment === null,
  'reconciliation grants the period from state, but records no payment at list price');
const cancelling = syncSubscription({ tier: 'pro' }, snap({ cancelAtPeriodEnd: true }) as any, 'pro', CFG);
ok(cancelling.stateUpdate.subscription_status === 'cancelled', 'cancel at period end → cancelled, access kept');
const pastDue = syncSubscription({ tier: 'pro' }, snap({ status: 'past_due' }) as any, 'pro', CFG);
ok(pastDue.stateUpdate.subscription_status === 'past_due' && pastDue.grant.ledgerKey === null, 'past due changes status only');
const ended = syncSubscription({ tier: 'pro', purchased_tokens: 9, billing_mode: 'subscription', bachs_subscription_id: 'sub_1' }, snap({ status: 'canceled' }) as any, 'pro', CFG);
ok(ended.grant.ledgerKey === 'end:sub_1' && ended.grant.userUpdate?.tier === 'free' && ended.grant.userUpdate?.monthly_tokens === 0
  && ended.grant.userUpdate?.purchased_tokens === 9 && ended.grant.userUpdate?.billing_mode === null, 'ended → Free once, purchased tokens kept');
const unpaid = syncSubscription({ tier: 'pro', billing_mode: 'subscription', bachs_subscription_id: 'sub_1' }, snap({ status: 'unpaid' }) as any, 'pro', CFG);
ok(unpaid.grant.ledgerKey === 'end:sub_1' && unpaid.grant.userUpdate?.tier === 'free', 'unpaid ends it too');
ok(syncSubscription({}, snap() as any, null, CFG).grant.review !== null, 'an unknown product goes to review');
ok(syncSubscription({}, snap({ amountMinor: 100 }) as any, 'pro', CFG).grant.review !== null, 'a product billing the wrong amount goes to review');
ok(syncSubscription({}, snap({ status: 'trialing' }) as any, 'pro', CFG).grant.ledgerKey === null, 'a trial grants nothing (trials are not sold)');
ok(s1.grant.review === null && !('pass_expires_at' in (s1.grant.userUpdate ?? {})), 'with no pass in the way a period grants cleanly: no review, no pass fields touched');

/* Two checkouts opened in two tabs: a naira pass is paid, then a USD subscription activates while it runs. */
const overlapPass = { tier: 'pro', billing_mode: 'pass' as const, pass_expires_at: '2026-10-20T00:00:00.000Z', pass_reminded: [5], monthly_tokens: 50, purchased_tokens: 7, subscription_status: 'active' };
const overlap = syncSubscription(overlapPass, snap({ productId: 'prod_t', amountMinor: 7900 }) as any, 'team', CFG);
ok(overlap.grant.userUpdate?.tier === 'team' && overlap.grant.userUpdate?.billing_mode === 'subscription',
  'a USD period activating over a live pass is still granted (the customer paid for it)');
ok(overlap.grant.userUpdate?.pass_expires_at === null && Array.isArray(overlap.grant.userUpdate?.pass_reminded) && (overlap.grant.userUpdate?.pass_reminded as unknown[]).length === 0,
  'and the pass fields are cleared so the pass-expiry job cannot later drop the subscriber to Free');
ok(overlap.grant.review !== null && overlap.grant.review.includes('2026-10-20T00:00:00.000Z') && /pass/i.test(overlap.grant.review),
  'and it is flagged for review, naming the overlapping pass and its expiry, so the unused pass days can be refunded');
ok(overlap.grant.userUpdate?.purchased_tokens === 7 && overlap.grant.ledgerKey === 'period:sub_1:2026-10-01T00:00:00Z:prod_t',
  'purchased tokens survive, and the ledger key is unchanged by the overlap');
const lateSync = syncSubscription({ ...overlapPass, pass_expires_at: '2026-10-10T00:00:00.000Z' }, snap() as any, 'pro', CFG);
ok(lateSync.grant.review !== null, 'liveness is judged at the period start, not the clock: a pass live on 1 Oct is an overlap however late the sync runs');
const lapsed = syncSubscription({ ...overlapPass, pass_expires_at: '2026-09-20T00:00:00.000Z' }, snap() as any, 'pro', CFG);
ok(lapsed.grant.review === null && !('pass_expires_at' in (lapsed.grant.userUpdate ?? {})), 'a pass that ended before the period started is not an overlap');
ok(syncSubscription({ ...usdSub, pass_expires_at: '2099-01-01T00:00:00.000Z' }, snap() as any, 'pro', CFG).grant.review === null,
  'a subscriber with a leftover pass date (not a live pass) renews without a review');

/* An active snapshot with no readable period start cannot be keyed: a shared `…:null:…` key would
   be consumed by the first sync and make every renewal look already-granted. It is reviewed, not granted. */
const noStartAcct = { ...overlapPass, pass_expires_at: '2099-01-01T00:00:00.000Z' };
const noStart = syncSubscription(noStartAcct, snap({ currentPeriodStart: null }) as any, 'pro', CFG);
ok(noStart.grant.review === 'active subscription with no readable period start' && noStart.grant.userUpdate === null && noStart.grant.payment === null,
  'an active subscription with no period start is reviewed, not granted (no userUpdate, no payment)');
ok(noStart.grant.ledgerKey === 'period:sub_1:nostart:prod_p' && !('subscription_status' in noStart.stateUpdate) && !('plan_renews_at' in noStart.stateUpdate)
  && noStart.stateUpdate.bachs_subscription_id === 'sub_1', 'it is keyed apart from any real period, and only the ids are stored (no status or renewal change)');
ok(JSON.stringify(syncSubscription(noStartAcct, snap({ currentPeriodStart: null }) as any, 'pro', CFG)) === JSON.stringify(noStart),
  'and the result does not depend on the clock: the same input gives the same output');
const badStart = syncSubscription(noStartAcct, snap({ currentPeriodStart: 'not a date' }) as any, 'pro', CFG);
ok(badStart.grant.userUpdate === null && badStart.grant.review !== null, 'an unparseable period start is treated the same way');
const afterNoStart = syncSubscription({ tier: 'free', bachs_subscription_id: 'sub_1' }, snap() as any, 'pro', CFG);
ok(afterNoStart.grant.userUpdate?.tier === 'pro' && afterNoStart.grant.review === null, 'once Bachs sends a real period start the subscription grants normally');

/* The sync must only act on the account's CURRENT subscription. */
const liveSub = { tier: 'pro', billing_mode: 'subscription' as const, subscription_status: 'active', bachs_subscription_id: 'sub_1', monthly_tokens: 200, purchased_tokens: 9 };
const endOther = syncSubscription({ ...liveSub, bachs_subscription_id: 'sub_2' }, snap({ status: 'canceled' }) as any, 'pro', CFG);
ok(endOther.grant.userUpdate === null && Object.keys(endOther.stateUpdate).length === 0 && endOther.grant.review !== null && endOther.grant.ledgerKey === 'end:sub_1',
  'a subscription that ends but is not the account\'s current one leaves the account unchanged and is reviewed (once)');
const endCurrent = syncSubscription(liveSub, snap({ status: 'canceled' }) as any, 'pro', CFG);
ok(endCurrent.grant.userUpdate?.tier === 'free' && endCurrent.grant.review === null && endCurrent.grant.userUpdate?.bachs_subscription_id === null,
  'the account\'s own subscription ending still drops it to Free');
const endOnPass = syncSubscription(proPass(day(10)), snap({ status: 'canceled' }) as any, 'pro', CFG);
ok(endOnPass.grant.userUpdate === null && endOnPass.grant.review !== null,
  'a subscription that ended while the account holds a pass and stores no subscription id does not drop the pass holder to Free');
const second = syncSubscription({ ...liveSub, bachs_subscription_id: 'sub_0' }, snap({ id: 'sub_2' }) as any, 'pro', CFG);
ok(second.grant.userUpdate?.tier === 'pro' && second.grant.review !== null
  && second.grant.review.includes('sub_0') && second.grant.review.includes('sub_2'),
  'a second live subscription is still granted (the customer paid) and flagged, naming both ids, so one can be refunded');
ok(syncSubscription(liveSub, snap({ currentPeriodStart: '2026-11-01T00:00:00Z' }) as any, 'pro', CFG).grant.review === null,
  'renewing the account\'s own subscription is not flagged');

/* A second subscription never re-points "current": the first stays current, deterministically. */
ok(Object.keys(second.stateUpdate).length === 0, 'a second subscription writes no state (no ids, status or renewal date)');
let acct: any = { ...liveSub };
const stateOf2: Record<string, unknown>[] = [];
for (const id of ['sub_1', 'sub_2', 'sub_1', 'sub_2']) {
  const r = syncSubscription(acct, snap({ id }) as any, 'pro', CFG);
  if (id === 'sub_2') stateOf2.push(r.stateUpdate);
  acct = { ...acct, ...r.stateUpdate };
}
ok(acct.bachs_subscription_id === 'sub_1' && stateOf2.every((s) => Object.keys(s).length === 0),
  'syncing sub_1 and sub_2 alternately leaves the stored id on sub_1 every time (sub_2\'s state is always empty)');
const pastDue2 = syncSubscription(liveSub, snap({ id: 'sub_2', status: 'past_due' }) as any, 'pro', CFG);
ok(Object.keys(pastDue2.stateUpdate).length === 0 && pastDue2.grant.ledgerKey === null, 'a non-current subscription going past due changes nothing on the account');
const trial2 = syncSubscription(liveSub, snap({ id: 'sub_2', status: 'trialing' }) as any, 'pro', CFG);
ok(Object.keys(trial2.stateUpdate).length === 0, 'nor does any other status update from a non-current subscription');
const end2 = syncSubscription(acct, snap({ id: 'sub_2', status: 'canceled' }) as any, 'pro', CFG);
ok(end2.grant.userUpdate === null && Object.keys(end2.stateUpdate).length === 0 && end2.grant.review !== null && acct.bachs_subscription_id === 'sub_1',
  'so ending sub_2 afterwards leaves the account on sub_1 unchanged, with a review');
const end1 = syncSubscription(acct, snap({ id: 'sub_1', status: 'canceled' }) as any, 'pro', CFG);
ok(end1.grant.userUpdate?.tier === 'free', 'and ending sub_1 (the current one) downgrades');
const noId = syncSubscription({ tier: 'free' }, snap({ id: 'sub_2' }) as any, 'pro', CFG);
ok(noId.stateUpdate.bachs_subscription_id === 'sub_2' && noId.stateUpdate.subscription_status === 'active', 'an account with no stored subscription id adopts the first one it sees');
ok(second.grant.review !== null && second.grant.review.includes('refund and cancel sub_2 (duplicate)') && second.grant.review.includes("sub_0 is the account's current subscription"),
  'the duplicate review says which one to refund and cancel, and which one is current');

/* A stored id that was never GRANTED (no-start or non-active snapshot) must not stay "current" for good. */
const noStartPass = syncSubscription(proPass(day(10)), snap({ currentPeriodStart: null }) as any, 'pro', CFG);
ok(noStartPass.stateUpdate.bachs_subscription_id === 'sub_1' && !('billing_currency' in noStartPass.stateUpdate),
  'a subscription with no period start stores its ids on a pass holder but does not stamp billing_currency');
ok(!('billing_currency' in syncSubscription({}, snap({ status: 'trialing' }) as any, 'pro', CFG).stateUpdate)
  && !('billing_currency' in syncSubscription({}, snap({ status: 'past_due' }) as any, 'pro', CFG).stateUpdate),
  'nor does a trialing or past-due snapshot');
ok(s1.grant.userUpdate?.billing_currency === 'USD' && !('billing_currency' in s1.stateUpdate), 'billing_currency USD is set only by the granting period');
const passAfterNoStart = { ...proPass(day(10)), ...noStartPass.stateUpdate };
const endNoStart = syncSubscription(passAfterNoStart, snap({ status: 'canceled' }) as any, 'pro', CFG);
ok(endNoStart.grant.userUpdate === null && Object.keys(endNoStart.stateUpdate).length === 0 && endNoStart.grant.review !== null && endNoStart.grant.ledgerKey === 'end:sub_1',
  'trace 1: ending that never-granted subscription leaves the pass holder on their pass, with a review');

const applySync = (a: any, r: { stateUpdate: Record<string, unknown>; grant: { userUpdate: Record<string, unknown> | null } }) => ({ ...a, ...r.stateUpdate, ...(r.grant.userUpdate ?? {}) });
for (const [label, firstSnap] of [['no period start', { currentPeriodStart: null }], ['incomplete', { status: 'incomplete' }]] as const) {
  const stored1 = applySync({ tier: 'free', purchased_tokens: 3 }, syncSubscription({ tier: 'free', purchased_tokens: 3 }, snap(firstSnap) as any, 'pro', CFG));
  const paid2 = syncSubscription(stored1, snap({ id: 'sub_2' }) as any, 'pro', CFG);
  ok(stored1.bachs_subscription_id === 'sub_1' && paid2.stateUpdate.bachs_subscription_id === 'sub_2' && paid2.stateUpdate.subscription_status === 'active'
    && paid2.stateUpdate.plan_renews_at === '2026-11-01T00:00:00Z' && paid2.grant.userUpdate?.tier === 'pro',
    `trace 2 (${label}): sub_1 was stored without a grant, so the subscription that is actually paid (sub_2) becomes current and is granted`);
  const acct2 = applySync(stored1, paid2);
  const endSub1 = syncSubscription(acct2, snap({ status: 'canceled' }) as any, 'pro', CFG);
  ok(endSub1.grant.userUpdate === null && endSub1.grant.review !== null && acct2.tier === 'pro' && acct2.bachs_subscription_id === 'sub_2',
    `trace 2 (${label}): sub_1 ending does not drop the account paying through sub_2`);
  ok(syncSubscription(acct2, snap({ id: 'sub_2', status: 'canceled' }) as any, 'pro', CFG).grant.userUpdate?.tier === 'free',
    `trace 2 (${label}): sub_2 ending (the current one) downgrades`);
}

console.log('\nAPI WRAPPER:');
ok(bachsBaseUrl('sk_live_x') === 'https://api.bachs.io/v1' && bachsBaseUrl('sk_sandbox_x') === 'https://sandbox-api.bachs.io/v1',
  'the key decides the environment (a sandbox key can never reach live)');
const calls: Array<{ url: string; init: any }> = [];
let productsBody: unknown = { something: 1 };
const fakeFetch = (async (url: string, init: any) => {
  calls.push({ url, init });
  if (url.endsWith('/v1/products')) return new Response(JSON.stringify(productsBody), { status: 200 });
  if (url.endsWith('/v1/checkout-sessions')) return new Response(JSON.stringify({ checkout_id: 'chk_1', checkout_url: 'https://checkout.bachs.io/c/1' }), { status: 200 });
  if (url.includes('/subscriptions/sub_404')) return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'no' } }), { status: 404 });
  return new Response(JSON.stringify({ data: { id: 'sub_1', status: 'active' } }), { status: 200 });
}) as unknown as typeof fetch;
const api = bachsApi('sk_sandbox_k', fakeFetch);
const session = await api.createCheckoutSession({ reference: 'mb_1' }, 'mb_1');
ok(session.checkout_url === 'https://checkout.bachs.io/c/1', 'a checkout session returns its URL');
ok(calls[0].url.startsWith('https://sandbox-api.bachs.io/v1/'), 'a sandbox key sends the request to the sandbox host (the wiring, not only the pure helper)');
ok(calls[0].init.headers.Authorization === 'Bearer sk_sandbox_k' && calls[0].init.headers['Idempotency-Key'] === 'mb_1'
  && calls[0].init.method === 'POST', 'POSTs carry the bearer key and an idempotency key');
ok(((await api.getSubscription('sub_1')) as any).data.id === 'sub_1', 'a GET returns the parsed body');
let apiErr: any = null; try { await api.getSubscription('sub_404'); } catch (e) { apiErr = e; }
ok(apiErr instanceof BachsApiError && apiErr.status === 404 && apiErr.code === 'NOT_FOUND', 'an error response throws BachsApiError with status and code');
await api.cancelSubscriptionAtPeriodEnd('sub_1', 'cancel_sub_1');
const cancelCall = calls[calls.length - 1];
ok(cancelCall.init.method === 'DELETE' && JSON.parse(cancelCall.init.body).cancel_at_period_end === true,
  'cancel always sends cancel_at_period_end: true (an API cancel is otherwise immediate)');
ok(cancelCall.url.endsWith('/subscriptions/sub_1') && cancelCall.init.headers['Idempotency-Key'] === 'cancel_sub_1',
  'the cancel targets its subscription path with the idempotency key');
let shapeErr: any = null; try { await api.listProducts(); } catch (e) { shapeErr = e; }
ok(shapeErr instanceof BachsApiError && shapeErr.status === 0 && shapeErr.code === 'UNEXPECTED_SHAPE',
  'a products response with no items or data array throws UNEXPECTED_SHAPE, never an empty list (an empty list would make setup create duplicates)');
productsBody = { items: [{ id: 'p' }] };
const listed = await api.listProducts();
ok(Array.isArray(listed) && listed.length === 1 && (listed[0] as any).id === 'p', 'a products response with an items array returns that array');
productsBody = { data: [{ id: 'q' }] };
const listedData = await api.listProducts();
ok(Array.isArray(listedData) && listedData.length === 1 && (listedData[0] as any).id === 'q', 'a products response with a data array returns that array');

const liveLog: string[] = [];
const liveFetch = (async (url: string) => {
  liveLog.push(url);
  return new Response(JSON.stringify({ checkout_id: 'chk_9', checkout_url: 'https://checkout.bachs.io/c/9' }), { status: 200 });
}) as unknown as typeof fetch;
await bachsApi('sk_live_k', liveFetch).createCheckoutSession({ reference: 'mb_9' }, 'mb_9');
ok(String(liveLog[0]).startsWith('https://api.bachs.io/v1/'), 'a live key sends the request to the live host, never the sandbox');

/* Fake fetch that answers every request with one fixed body; `log` records what was sent. */
const replyWith = (text: string, status = 200) => {
  const log: Array<{ url: string; init: any }> = [];
  const f = (async (url: string, init: any) => {
    log.push({ url, init });
    return new Response(text, { status });
  }) as unknown as typeof fetch;
  return { log, f };
};
/* True only when the call rejected with UNEXPECTED_SHAPE. */
const rejectsShape = async (p: Promise<unknown>): Promise<boolean> => {
  try { await p; return false; } catch (e) { return e instanceof BachsApiError && e.status === 0 && e.code === 'UNEXPECTED_SHAPE'; }
};

const patch = replyWith(JSON.stringify({ data: { id: 'sub_1' } }));
await bachsApi('sk_sandbox_k', patch.f).changeSubscriptionProduct('sub_1', 'prod_x', 'chg_1');
const patchBody = JSON.parse(patch.log[0].init.body);
ok(patch.log[0].init.method === 'PATCH' && patch.log[0].url.endsWith('/subscriptions/sub_1') && patch.log[0].init.headers['Idempotency-Key'] === 'chg_1'
  && patchBody.product_id === 'prod_x' && patchBody.proration_behavior === 'invoice_now',
  'a plan change PATCHes its subscription with the new product, invoice_now proration and an idempotency key');

const portal = replyWith(JSON.stringify({ url: 'https://portal.bachs.io/p/1' }));
const portalSession = await bachsApi('sk_sandbox_k', portal.f).createPortalSession('cust_1', 'portal_1');
ok(portalSession.url === 'https://portal.bachs.io/p/1' && portal.log[0].init.method === 'POST' && portal.log[0].url.endsWith('/customers/cust_1/portal-sessions')
  && portal.log[0].init.headers['Idempotency-Key'] === 'portal_1', 'a portal session POSTs to its customer with an idempotency key and returns its url');

const created = replyWith(JSON.stringify({ id: 'p1' }));
const product = await bachsApi('sk_sandbox_k', created.f).createProduct({ name: 'Pro' }, 'prod_key_1');
ok(product.id === 'p1' && created.log[0].init.method === 'POST' && created.log[0].url.endsWith('/v1/products') && created.log[0].init.headers['Idempotency-Key'] === 'prod_key_1',
  'createProduct POSTs with an idempotency key and returns the product id');
const wrapped = replyWith(JSON.stringify({ data: { id: 'p2' } }));
ok((await bachsApi('sk_sandbox_k', wrapped.f).createProduct({}, 'prod_key_2')).id === 'p2', 'a product in a data envelope is unwrapped');

ok(await rejectsShape(bachsApi('sk_sandbox_k', replyWith('{}').f).createCheckoutSession({}, 'k_c1')), 'a checkout with no checkout_url is UNEXPECTED_SHAPE, not a session');
ok(await rejectsShape(bachsApi('sk_sandbox_k', replyWith('').f).createCheckoutSession({}, 'k_c2')), 'a checkout with an empty body is UNEXPECTED_SHAPE');
ok(await rejectsShape(bachsApi('sk_sandbox_k', replyWith('<html>gateway</html>').f).createCheckoutSession({}, 'k_c3')), 'a checkout with an HTML body is UNEXPECTED_SHAPE');
ok(await rejectsShape(bachsApi('sk_sandbox_k', replyWith(JSON.stringify({ checkout: { checkout_url: 'https://x' } })).f).createCheckoutSession({}, 'k_c4')), 'a checkout in a wrong envelope is UNEXPECTED_SHAPE');
ok(await rejectsShape(bachsApi('sk_sandbox_k', replyWith('{}').f).createPortalSession('cust_1', 'k_p1')), 'a portal session with no url is UNEXPECTED_SHAPE');
ok(await rejectsShape(bachsApi('sk_sandbox_k', replyWith('').f).createPortalSession('cust_1', 'k_p2')), 'a portal session with an empty body is UNEXPECTED_SHAPE');
ok(await rejectsShape(bachsApi('sk_sandbox_k', replyWith(JSON.stringify({ product: { id: 'p1' } })).f).createProduct({}, 'k_pr1')), 'a product in a wrong envelope is UNEXPECTED_SHAPE, never the id "undefined"');
ok(await rejectsShape(bachsApi('sk_sandbox_k', replyWith('null').f).createProduct({}, 'k_pr2')), 'a product with a null body is UNEXPECTED_SHAPE');
ok(await rejectsShape(bachsApi('sk_sandbox_k', replyWith('{}').f).createProduct({}, 'k_pr3')), 'a product with no id is UNEXPECTED_SHAPE');

const noKey = replyWith('{}');
let keyErr: any = null; try { await bachsApi('sk_sandbox_k', noKey.f).changeSubscriptionProduct('sub_1', 'prod_x', ''); } catch (e) { keyErr = e; }
ok(keyErr instanceof BachsApiError && keyErr.code === 'NO_IDEMPOTENCY_KEY' && noKey.log.length === 0, 'a write with an empty idempotency key is refused before any request is sent');

let badKey: any = null; try { bachsApi('sk_sandbox_QZ9 part', fakeFetch); } catch (e) { badKey = e; }
ok(badKey instanceof BachsApiError && badKey.code === 'BAD_KEY' && !String(badKey.message).includes('QZ9'), 'a malformed key is refused with a generic message that does not echo it');
const echo = replyWith(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'token sk_sandbox_k was rejected' } }), 401);
let echoErr: any = null; try { await bachsApi('sk_sandbox_k', echo.f).getSubscription('sub_1'); } catch (e) { echoErr = e; }
ok(echoErr instanceof BachsApiError && echoErr.message === 'token [redacted] was rejected' && echoErr.status === 401,
  'a Bachs error that echoes the key comes back with the key redacted');
const longErr = replyWith(JSON.stringify({ error: { code: 'X', message: 'a'.repeat(400) } }), 400);
let capErr: any = null; try { await bachsApi('sk_sandbox_k', longErr.f).getSubscription('sub_1'); } catch (e) { capErr = e; }
ok(capErr instanceof BachsApiError && capErr.message.length === 300, 'an error message is capped at 300 characters');

console.log('EMAILS:');
/* templates.ts imports only the local layout helpers, so it renders here with no Firebase or Resend.
   money() is not exported; the rendered subject and html are what a customer actually reads. */
const mail = (key: string, data: any): { subject: string; html: string } => {
  try { return (EMAIL_TEMPLATES as any)[key](data); } catch (e: any) { return { subject: `RENDER_FAILED: ${e?.message || e}`, html: '' }; }
};
const receiptBase = { packLabel: 'Starter', tokens: 100, newBalance: 120, reference: 'ref_1', date: '1 Nov 2026', description: 'Pro pass', planName: 'Pro' };
ok(mail('tokenReceipt', { ...receiptBase, amount: 10, currency: 'USD' }).html.includes('$10.00'), 'a dollar token receipt shows $10.00');
ok(mail('tokenReceipt', { ...receiptBase, amount: 10 }).html.includes('$10.00'), 'a receipt with no currency is still dollars');
const ngnReceipt = mail('tokenReceipt', { ...receiptBase, amount: 5000, currency: 'NGN' }).html;
ok(ngnReceipt.includes('₦5,000') && !ngnReceipt.includes('$5000.00'), 'a naira token receipt shows ₦5,000, whole, not $5000.00');
ok(mail('paymentReceipt', { ...receiptBase, amount: 9900, currency: 'NGN' }).html.includes('₦9,900'), 'a naira payment receipt shows ₦9,900');
ok(mail('paymentReceipt', { ...receiptBase, amount: 19, currency: 'USD' }).html.includes('$19.00'), 'a dollar payment receipt shows $19.00');
ok(mail('paymentFailed', { planName: 'Pro', amount: 9900, currency: 'NGN' }).html.includes('₦9,900'), 'a naira failed-payment notice shows ₦9,900');
ok(mail('paymentFailed', { planName: 'Pro', amount: 19 }).html.includes('$19.00'), 'a failed-payment notice with no currency shows $19.00');

const reminder = mail('passReminder', { planName: 'Pro', expiresAt: '5 Nov 2026', daysLeft: 3, amount: 9900, currency: 'NGN' });
ok(reminder.subject === 'Your Pro pass ends in 3 days', 'passReminder subject names the plan and the days left', reminder.subject);
ok(reminder.html.includes('₦9,900') && reminder.html.includes('5 Nov 2026'), 'passReminder shows the naira renewal price and the end date');
ok(mail('passReminder', { planName: 'Pro', expiresAt: 'x', daysLeft: 1, amount: 9900, currency: 'NGN' }).subject === 'Your Pro pass ends in 1 day', 'passReminder says "1 day", not "1 days"');
const expired = mail('passExpired', { planName: 'Team' });
ok(expired.subject === 'Your Team pass has ended' && expired.html.includes('Buy a new pass'), 'passExpired names the plan and offers a new pass', expired.subject);
const alertMail = mail('billingAlert', { title: '2 payments need review', lines: ['order o_1: amount mismatch', 'order o_2: unknown account'] });
ok(alertMail.subject === '[Billing] 2 payments need review', 'billingAlert subject carries the [Billing] prefix', alertMail.subject);
ok(alertMail.html.includes('order o_1: amount mismatch') && alertMail.html.includes('order o_2: unknown account'), 'billingAlert lists every line');
ok(!alertMail.html.includes('Nothing was granted') && alertMail.html.includes('Review the items below'),
  'billingAlert hero stays neutral: it must not claim nothing was granted (reconciliation lines say payments were)');
ok(!mail('billingAlert', { title: 'No lines' }).subject.startsWith('RENDER_FAILED'), 'billingAlert with no lines still renders (an alert that throws is silence)');
ok(!mail('billingAlert', { title: '<b>x</b> & y', lines: [] }).html.includes('<b>x</b>'), 'billingAlert escapes its title (the layout heading is raw HTML)');
for (const key of ['passReminder', 'passExpired', 'billingAlert']) {
  ok(key in EMAIL_TEMPLATES && !(MARKETING_KEYS as Set<string>).has(key), `${key} is a transactional template (no unsubscribe rule)`);
}

console.log('\nTHE SWITCH REACHES THE BUTTONS:');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
/* Comments blanked, so prose that mentions a name cannot satisfy a check about code. */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const idx = src('functions/src/index.ts');
const webhookAt = idx.indexOf('export const bachsWebhook');
/* The webhook alone: from its export to the next export, comments blanked. Anything the file says
   about `rawBody` or a signature elsewhere (or in prose) cannot vouch for it. */
const nextExport = (at: number) => { const n = idx.indexOf('\nexport const ', at + 10); return n < 0 ? idx.length : n; };
const webhook = code(webhookAt < 0 ? '' : idx.slice(webhookAt, nextExport(webhookAt)));
/* The retired provider's name is spelled with a character class so that this file, like the rest of
   the source tree, never contains it (the cleanup is checked by grepping for the name). */
ok(/export const bachsWebhook = /.test(idx) && !/export const pay[s]tackWebhook = /.test(idx), 'bachsWebhook is the payment webhook; the old provider\'s webhook is gone');
const statusAt = idx.indexOf('export const billingStatus');
ok(statusAt >= 0 && /provider: 'bachs'/.test(idx.slice(statusAt, statusAt + 500)), 'billingStatus reports provider bachs');
ok(/billingStatus = functions\.runWith\(\{ secrets: \['BACHS_SECRET_KEY'\] \}\)/.test(idx),
  'billingStatus is bound to the key (otherwise it can never see it and always says "not live")');
/* Least privilege: billingStatus only asks whether a key is present and never reads the webhook secret. */
const statusText = code(statusAt < 0 ? '' : idx.slice(statusAt, nextExport(statusAt)));
ok(statusText.length > 0 && !/BACHS_WEBHOOK_SECRET|BACHS_SECRETS/.test(statusText.slice(0, 400)),
  'billingStatus does not bind the webhook secret');
ok(/rawBody/.test(webhook), 'the webhook verifies the raw body');
ok(/fetchBillingStatus\(\)/.test(src('pages/Pricing.tsx')) && /fetchBillingStatus\(\)/.test(src('components/SubscriptionPanel.tsx')),
  'the pricing page and the plan panel read billing status');
const billingSvc = code(src('services/billing.ts'));
ok(/billingStatus/.test(billingSvc) && !/billing_live:\s*true/.test(billingSvc) && (billingSvc.match(/billing_live: false/g) || []).length >= 2,
  'the client fails CLOSED: no path answers "live" except a confirmed one, and both error paths answer "not live"');

/* THE PRERENDERED PRICING PAGE IS ALWAYS DOLLARS. Pricing picks its first currency from the browser
   (timezone Africa/Lagos or an -NG locale means naira), and the prerender runs that same code in a
   headless browser — so a build on a machine whose zone or locale says Nigeria would bake naira
   prices and the pass note into the static HTML every visitor and crawler receives. The prerender
   pins its pages to UTC and en-US; the toggle still defaults per visitor at runtime. */
export const prerenderPinsDollars = (text: string): boolean => {
  const c = code(text);
  return /page\.emulateTimezone\('UTC'\)/.test(c)
    && /Object\.defineProperty\(navigator, 'languages', \{ get: \(\) => \['en-US'\] \}\)/.test(c)
    && /Object\.defineProperty\(navigator, 'language', \{ get: \(\) => 'en-US' \}\)/.test(c);
};
console.log('\nTHE PRERENDERED PRICING IS ALWAYS DOLLARS:');
const prerenderSrc = src('scripts/prerender.ts');
ok(prerenderPinsDollars(prerenderSrc), 'scripts/prerender.ts pins every prerendered page to the UTC timezone and the en-US locale');
const pinnedGood = "await page.emulateTimezone('UTC');\nawait page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'languages', { get: () => ['en-US'] }); Object.defineProperty(navigator, 'language', { get: () => 'en-US' }); });";
ok(prerenderPinsDollars(pinnedGood), 'a correctly pinned prerender passes');
ok(!prerenderPinsDollars(pinnedGood.replace("emulateTimezone('UTC')", "emulateTimezone('Africa/Lagos')")), 'CONTROL: a prerender pinned to another timezone is caught');
ok(!prerenderPinsDollars(pinnedGood.replace(/await page\.emulateTimezone\('UTC'\);\n/, '')), 'CONTROL: a prerender with no timezone pin is caught');
ok(!prerenderPinsDollars(pinnedGood.replace("'language', { get: () => 'en-US' }", "'language', { get: () => 'en-NG' }")), 'CONTROL: a prerender that leaves the locale to the machine is caught');
ok(!prerenderPinsDollars("// await page.emulateTimezone('UTC');\n" + pinnedGood.split('\n')[1]), 'CONTROL: a pin that only appears in a comment is caught');

/* THE CLIENT PROFILE CARRIES THE BILLING FIELDS THE SERVER WRITES. `getUserProfile` builds the profile from an
   explicit field list, not a spread of the document, so a field that is not named there never reaches any
   component: the billing page, the plan panel and the pricing page all read `billing_mode` and `billing_currency`
   and silently saw `undefined` (a naira pass holder was shown a dollar price and a renewal date). The balance
   split (`monthly_tokens`, `purchased_tokens`) is read by the billing page for the same reason. */
export const BILLING_PROFILE_FIELDS = ['billing_mode', 'billing_currency', 'pass_expires_at', 'bachs_customer_id', 'monthly_tokens', 'purchased_tokens'];
export const unmappedProfileFields = (persistence: string): string[] => {
  const c = code(persistence);
  const start = c.indexOf('export const getUserProfile =');
  const end = start < 0 ? -1 : c.indexOf('\nexport const ', start + 10);
  const body = start < 0 ? '' : c.slice(start, end < 0 ? undefined : end);
  return BILLING_PROFILE_FIELDS.filter((f) => !new RegExp(`\\b${f}: data\\.${f}\\b`).test(body));
};
console.log('\nTHE CLIENT PROFILE CARRIES THE BILLING FIELDS:');
const persistenceSrc = src('services/persistenceService.ts');
const unmapped = unmappedProfileFields(persistenceSrc);
ok(unmapped.length === 0, 'getUserProfile maps billing_mode, billing_currency, pass_expires_at, bachs_customer_id, monthly_tokens and purchased_tokens', `unmapped: ${unmapped.join(', ')}`);
for (const f of BILLING_PROFILE_FIELDS) {
  const without = persistenceSrc.replace(new RegExp(`^.*\\b${f}: data\\.${f},?\\s*$`, 'm'), '');
  ok(without !== persistenceSrc && unmappedProfileFields(without).join() === f, `CONTROL: getUserProfile without its ${f} line is caught`);
}
ok(unmappedProfileFields(persistenceSrc.replace(/^(\s*)billing_mode: data\.billing_mode,/m, '$1// billing_mode: data.billing_mode,')).join() === 'billing_mode',
  'CONTROL: a mapping that is only commented out is caught');
ok(unmappedProfileFields('export const somethingElse = () => ({ billing_mode: data.billing_mode });').length === BILLING_PROFILE_FIELDS.length,
  'CONTROL: the same mapping in some other function does not count');

/* THE CURRENCY A BILLING SURFACE STARTS IN FOLLOWS THE ACCOUNT. A naira pass holder who opens Pricing
   from a laptop set to a US timezone must not be shown dollars, so the account's own `billing_currency`
   comes first and the browser's guess is only the fallback. One hook does it for all three surfaces
   (lazy initialiser; adopts the account's currency once if the profile arrives after first render). */
export const usesAccountCurrency = (surface: string): boolean =>
  /useCurrency\(profile\??\.billing_currency\)/.test(surface) && !/useState<Currency>/.test(surface);
console.log('\nTHE CURRENCY FOLLOWS THE ACCOUNT:');
const hookSrc = fs.existsSync(path.join(root, 'components', 'useCurrency.ts')) ? code(src('components/useCurrency.ts')) : '';
ok(/useState<Currency>\(\(\) => /.test(hookSrc) && /accountCurrency\(/.test(hookSrc) && /defaultCurrency\(\)/.test(hookSrc) && /useEffect\(/.test(hookSrc),
  'the currency hook starts from the account (lazy initialiser), falls back to the browser, and adopts a late profile');
for (const f of ['pages/Pricing.tsx', 'components/SubscriptionPanel.tsx', 'components/TokenStore.tsx']) {
  ok(usesAccountCurrency(code(src(f))), `${f} starts in the account's currency`);
}
ok(!usesAccountCurrency("const [currency, setCurrency] = useState<Currency>(defaultCurrency());"), 'CONTROL: a surface that starts from the browser alone is caught');
for (const f of ['components/SubscriptionPanel.tsx', 'components/TokenStore.tsx']) {
  const t = code(src(f));
  ok(/aria-label=\{c === 'NGN' \? 'Naira' : 'US dollars'\}/.test(t), `${f}: the compact ₦ / $ buttons are named for a screen reader`);
}
/* No Enterprise pass exists, so in naira mode its button must not promise "30 days": the "— 30 days" label
   is for plans that have a naira price in the pricing config. */
const pricingSrc = code(src('pages/Pricing.tsx'));
ok(/CFG\.plans\[tier\]\.priceNgn\s*\?\s*`Get \$\{PLAN_META\[tier\]\.name\} — 30 days`/.test(pricingSrc),
  'pages/Pricing.tsx offers "— 30 days" only to plans that have a naira price (not Enterprise)');

console.log('\nTHE WEBHOOK:');
ok(webhook.length > 0 && /functions\.runWith\(\{ secrets: BACHS_SECRETS \}\)\.https\.onRequest/.test(webhook),
  'the webhook is bound to the secrets it verifies with');
ok(webhook.indexOf('verifyBachsSignature(') > 0 && webhook.indexOf('verifyBachsSignature(') < webhook.indexOf('parseBachsEvent('),
  'the signature is checked before the body is read as an event');
ok(/applyOneOffPayment\((?:event|paid), 'webhook'\)/.test(webhook), 'a paid one-off goes to the one-off grant helper');
ok(/syncSubscriptionById\(event\.subscriptionId, null, 'webhook'\)/.test(webhook),
  'a linked subscription is synced from Bachs (the sync finds the account by the subscription metadata)');
ok(webhook.length > 0 && !/bachs_subscription_id|bachs_customer_id/.test(webhook),
  'the webhook pre-writes no subscription or customer id (the sync adopts them under its current-subscription rules)');
ok(webhook.length > 0 && !/\btier\s*:|balanceFields\(/.test(webhook), 'the webhook writes no tier and no allowance itself');
ok(/res\.status\(500\)\.send\('Retry'\)/.test(webhook) && /res\.status\(401\)/.test(webhook),
  'a transient failure answers 500 (Bachs retries) and a bad signature answers 401');
ok(!/void applyOneOffPayment/.test(idx), 'the "no caller yet" placeholder is gone now the helper has one');

/* THE SIGNATURE CHECK MUST ACTUALLY BLOCK. Text that merely mentions `rawBody` and `verifyBachsSignature(`
   passes while the handler goes on to the grant helpers after a failed check — and anybody can open a
   checkout of their own, POST an unsigned "paid" event for its reference and get the plan. So the exact
   shape is pinned, on the webhook's own comment-blanked text: the raw bytes are required (400 without
   them), they and nothing re-serialised are what is verified, a failed check answers 401 AND returns,
   and that all happens before the body is read as an event. Whitespace is `\s`, so LF and CRLF both hold. */
export const signatureGateHolds = (w: string): boolean =>
  /const raw: Buffer \| undefined = \(req as any\)\.rawBody;/.test(w)
  && /if \(!raw\)[^\n]*res\.status\(400\)[^\n]*return;/.test(w)
  && /if \(!verifyBachsSignature\(raw, req\.headers\[BACHS_SIGNATURE_HEADER\], process\.env\.BACHS_WEBHOOK_SECRET\)\)\s*\{\s*res\.status\(401\)\.send\('Unauthorized'\);\s*return;\s*\}/.test(w)
  && !/JSON\.stringify\(req\.body\)/.test(w)
  && w.indexOf('verifyBachsSignature(') > 0 && w.indexOf('verifyBachsSignature(') < w.indexOf('parseBachsEvent(');
ok(signatureGateHolds(webhook), 'the webhook requires the raw body, verifies exactly those bytes, and answers 401 and RETURNS before reading any event');
const goodGate = [
  "export const bachsWebhook = functions.runWith({ secrets: BACHS_SECRETS }).https.onRequest(async (req: any, res: any) => {",
  "  if (req.method !== 'POST') { res.status(405).send('Use POST.'); return; }",
  "  const raw: Buffer | undefined = (req as any).rawBody;",
  "  if (!raw) { console.error('bachsWebhook: no rawBody'); res.status(400).send('Cannot verify.'); return; }",
  "  if (!verifyBachsSignature(raw, req.headers[BACHS_SIGNATURE_HEADER], process.env.BACHS_WEBHOOK_SECRET)) {",
  "    res.status(401).send('Unauthorized');",
  "    return;",
  "  }",
  "  const event = parseBachsEvent(req.body);",
  "});",
].join('\n');
ok(signatureGateHolds(goodGate) && signatureGateHolds(goodGate.replace(/\n/g, '\r\n')), 'a handler with the full gate passes (LF and CRLF)');
ok(!signatureGateHolds(goodGate.replace("res.status(401).send('Unauthorized');\n    return;\n", "res.status(401).send('Unauthorized');\n")),
  'CONTROL: a 401 that does not return (the handler carries on to the grant helpers) is caught');
ok(!signatureGateHolds(goodGate.replace('verifyBachsSignature(raw,', 'verifyBachsSignature(Buffer.from(JSON.stringify(req.body)),')),
  'CONTROL: verifying a re-serialised body instead of the raw bytes is caught');
ok(!signatureGateHolds(goodGate.replace(/  if \(!raw\)[^\n]*\n/, '')),
  'CONTROL: a handler that no longer refuses a missing raw body is caught');
ok(!signatureGateHolds(goodGate.replace("res.status(400).send('Cannot verify.'); return;", "res.status(400).send('Cannot verify.');")),
  'CONTROL: a missing raw body that answers 400 but does not return is caught');
ok(!signatureGateHolds(goodGate.replace("res.status(401).send('Unauthorized');", "res.status(200).send('Ignored');")),
  'CONTROL: a failed signature that is not answered 401 is caught');
ok(!signatureGateHolds(goodGate.replace('process.env.BACHS_WEBHOOK_SECRET', 'process.env.BACHS_SECRET_KEY')),
  'CONTROL: verifying against the wrong secret is caught');
ok(!signatureGateHolds(goodGate.replace("  const event = parseBachsEvent(req.body);\n", '').replace('  if (!raw)', "  const event = parseBachsEvent(req.body);\n  if (!raw)")),
  'CONTROL: reading the event before the signature is checked is caught');

/* WHICHEVER ONE-OFF EVENT ARRIVES FIRST (final review C1). Bachs says fulfil on collection.succeeded OR
   checkout.completed, whichever comes first, and its documented checkout.completed has no top-level
   amount (a session keeps it under `pricing`). Reviewed as a mismatch, that event spent the once-only
   key and marked the checkout `review`, so the collection that did carry the amount was "already
   handled" and reconciliation (open checkouts only) never looked again: paid, granted nothing. An
   unreadable amount or currency now decides nothing, and the event that carries the amount grants once. */
console.log('\nWHICHEVER ONE-OFF EVENT ARRIVES FIRST:');
const passChk = checkout('pass', 'pro', 'NGN', 990000);
const completedBare = parseBachsEvent(ev('checkout.completed', { id: 'chk_1', mode: 'payment', payment_status: 'paid', reference: 'mb_1', metadata: { uid: 'u1' } }));
const collectedPaid = parseBachsEvent(ev('collection.succeeded', { reference: 'mb_1', status: 'SUCCEEDED', amount: '9900.00', currency: 'NGN', checkout_id: 'chk_1' }));
ok(completedBare?.kind === 'one_off_paid' && completedBare.amountMinor === null && completedBare.currency === null && completedBare.checkoutId === 'chk_1',
  'a paid checkout.completed with no amount is still a one-off payment, amount and currency unread, its session id kept');
const bareResult = applyOneOff(free, passChk, completedBare!, CFG, T0);
ok(bareResult.ledgerKey === null && bareResult.review === null && bareResult.checkoutStatus === null
  && bareResult.userUpdate === null && bareResult.payment === null && bareResult.deferred === 'amount unreadable',
  'it is deferred: no ledger key, no review, no checkout status, nothing granted');
ok(applyOneOff(free, passChk, { reference: 'mb_1', amountMinor: 990000, currency: null }, CFG, T0).deferred === 'amount unreadable',
  'a readable amount with an unreadable currency is deferred too');
/* The ledger as applyOneOffPayment's transaction uses it: a key already present is "already handled". */
const settle = (events: Array<ReturnType<typeof parseBachsEvent>>) => {
  const ledger = new Set<string>();
  let account: Record<string, unknown> = { ...free };
  let grants = 0;
  for (const e of events) {
    const r = applyOneOff(account as any, passChk, e!, CFG, T0);
    if (!r.ledgerKey || ledger.has(r.ledgerKey)) continue;
    ledger.add(r.ledgerKey);
    if (r.userUpdate) { grants++; account = { ...account, ...r.userUpdate }; }
  }
  return { grants, account };
};
const bareFirst = settle([completedBare, collectedPaid]);
ok(bareFirst.grants === 1 && bareFirst.account.tier === 'pro' && bareFirst.account.monthly_tokens === 300,
  'checkout.completed (no amount) then collection.succeeded (the amount): Pro is granted exactly once');
const collectedFirst = settle([collectedPaid, completedBare, collectedPaid]);
ok(collectedFirst.grants === 1 && collectedFirst.account.monthly_tokens === 300,
  'collection.succeeded first, then checkout.completed and a redelivery: still exactly one grant');
const priced = parseBachsEvent(ev('checkout.completed', { id: 'chk_8', mode: 'payment', payment_status: 'paid', reference: 'mb_8', pricing: { amount: '5000.00', currency: 'NGN' } }));
ok(priced?.amountMinor === 500000 && priced.currency === 'NGN', 'a session amount under pricing.amount / pricing.currency ("5000.00", "NGN") reads as 500000 NGN');
ok(parseBachsEvent(ev('checkout.completed', { id: 'chk_8', mode: 'payment', payment_status: 'paid', reference: 'mb_8', amount: '10.00', currency: 'USD', pricing: { amount: '5000.00', currency: 'NGN' } }))?.amountMinor === 1000,
  'a top-level amount is still read first');
ok(attempt(() => parseBachsEvent(ev('checkout.completed', { id: 'chk_8', mode: 'payment', payment_status: 'paid', reference: 'mb_8', pricing: 'x' }))?.amountMinor) === null,
  'a pricing that is not an object reads as no amount, without throwing');
const wrongPaid = applyOneOff(free, passChk, pay(100), CFG, T0);
ok(wrongPaid.review !== null && wrongPaid.ledgerKey === 'checkout:mb_1' && wrongPaid.checkoutStatus === 'review' && !wrongPaid.deferred,
  'a READABLE amount that is wrong still goes to review, keyed and recorded once');
ok(applyOneOff(free, null, { reference: 'mb_1', amountMinor: null, currency: null }, CFG, T0).review !== null,
  'a reference we never issued is reviewed whatever the amount (that decision does not need one)');

/* manageBilling ACTS ONLY ON A SUBSCRIPTION THE CALLER OWNS (final review I5). It used to act on the ids
   stored on the account, and a self-created profile could seed those ids: cancel or upgrade somebody
   else's subscription, or open their card portal. The subscription Bachs reports must name the caller in
   its metadata (we put the uid there at checkout); with no uid there it fails closed and alerts. */
console.log('\nmanageBilling OWNERSHIP:');
const owner = { tier: 'pro', billing_mode: 'subscription' as const, subscription_status: 'active', bachs_subscription_id: 'sub_1', bachs_customer_id: 'cust_1' };
const ownedSnap = snap() as any;
ok(manageOwnership('u1', owner, ownedSnap, 'cancel').ok && manageOwnership('u1', owner, ownedSnap, 'upgrade').ok && manageOwnership('u1', owner, ownedSnap, 'portal').ok,
  'the owner may cancel, upgrade and open the portal');
const stranger = manageOwnership('u2', owner, ownedSnap, 'cancel');
ok(!stranger.ok && !!stranger.reason && !!stranger.alert, 'another uid is refused (and the founder is alerted)');
ok(!manageOwnership('u2', owner, ownedSnap, 'upgrade').ok && !manageOwnership('u2', owner, ownedSnap, 'portal').ok, 'for every action');
const noUid = manageOwnership('u1', owner, snap({ metadata: {} }) as any, 'cancel');
ok(!noUid.ok && /support/i.test(noUid.reason) && !!noUid.alert, 'a subscription with no uid in its metadata is refused with a support message and an alert (fail closed)');
ok(!manageOwnership('u1', owner, null, 'cancel').ok, 'an unreadable subscription is refused');
ok(!manageOwnership('u1', owner, snap({ id: 'sub_9' }) as any, 'cancel').ok, 'a snapshot of a different subscription than the stored one is refused');
ok(!manageOwnership('u1', { ...owner, bachs_customer_id: 'cust_9' }, ownedSnap, 'portal').ok,
  'the portal is refused when the stored customer is not the subscription\'s customer');
ok(!manageOwnership('u1', { ...owner, bachs_customer_id: null }, ownedSnap, 'portal').ok, 'and when no customer is stored');
ok(manageOwnership('u1', { ...owner, bachs_customer_id: 'cust_9' }, ownedSnap, 'cancel').ok,
  'the customer match is a portal rule only (a cancel is checked by the subscription\'s uid)');

/* A SUBSCRIPTION PAYMENT IS A PAID INVOICE, NOTHING ELSE (final review I6). State-only events (customer.subscription.*,
   invoice.payment_failed), manageBilling and reconciliation all synced with no charge, and a new period
   then wrote a `payments` doc 'success' at list price and mailed a receipt — money nobody had seen. Now
   the period grant (from state) records nothing, and a payment and its receipt come only from an
   invoice.paid carrying its invoice id and a readable amount, keyed `invoice:{id}` apart from the
   period, so it is recorded even when an earlier state event already granted the period. */
console.log('\nA SUBSCRIPTION PAYMENT IS A PAID INVOICE:');
const invoicePaid = parseBachsEvent(ev('invoice.paid', { id: 'in_1', subscription: 'sub_1', amount_paid: '19.00', currency: 'usd' }));
ok(invoicePaid?.invoiceId === 'in_1' && invoicePaid.subscriptionId === 'sub_1', 'invoice.paid carries its invoice id (data.id)');
ok(parseBachsEvent(ev('customer.subscription.updated', { id: 'sub_1', status: 'active' }))?.invoiceId === null,
  'a subscription event has no invoice id (its data.id is the subscription)');
const recorded = invoicePayment(invoicePaid!, 'USD');
ok(recorded?.ledgerKey === 'invoice:in_1' && recorded.amountMinor === 1900 && recorded.currency === 'USD' && recorded.invoiceId === 'in_1',
  'a paid invoice with an id and a readable amount is recorded once, keyed invoice:{id}, in cents as charged');
ok(invoicePayment(parseBachsEvent(ev('invoice.paid', { id: 'in_2', subscription: 'sub_1', total: '60.00' }))!, 'USD')?.currency === 'USD',
  'an invoice that names no currency takes the subscription\'s');
ok(invoicePayment(parseBachsEvent(ev('invoice.paid', { id: 'in_2', subscription: 'sub_1', total: '60.00' }))!, null) === null,
  'and with no currency anywhere it records nothing (never a guessed currency)');
ok(invoicePayment(parseBachsEvent(ev('invoice.paid', { subscription: 'sub_1', amount_paid: '19.00' }))!, 'USD') === null, 'an invoice.paid with no invoice id records nothing');
ok(invoicePayment(parseBachsEvent(ev('invoice.paid', { id: 'in_3', subscription: 'sub_1', amount_paid: 'n/a' }))!, 'USD') === null, 'an invoice.paid with an unreadable amount records nothing');
ok(invoicePayment(parseBachsEvent(ev('invoice.paid', { id: 'in_4', subscription: 'sub_1', amount_paid: '0.00' }))!, 'USD') === null, 'a zero invoice is not a payment');
ok(invoicePayment(parseBachsEvent(ev('invoice.payment_failed', { id: 'in_5', subscription: 'sub_1', amount_paid: '19.00' }))!, 'USD') === null,
  'a failed invoice records nothing');
ok(invoicePayment(parseBachsEvent(ev('customer.subscription.updated', { id: 'sub_1', status: 'active', amount: '19.00' }))!, 'USD') === null,
  'a state event records nothing, whatever amount it carries');
ok([s1, renew, upgraded, recon, overlap, second].every((r) => r.grant.payment === null),
  'no period grant (first, renewal, upgrade, reconciliation, over a pass, duplicate) carries a payment record');

/* The webhook's Bachs reads must answer inside Bachs' 10s delivery window (final review M4). */
const hang = (async (_url: string, init: any) => new Promise((_resolve, reject) => {
  init.signal.addEventListener('abort', () => reject(new Error('aborted')));
})) as unknown as typeof fetch;
const hangStart = Date.now();
let hangErr: unknown = null;
/* AbortSignal.timeout's timer does not hold the process open, so a plain await on a hang would just
   end the run; this ref'd timer keeps it alive and caps the wait at 3s either way. */
let capTimer: ReturnType<typeof setTimeout> | undefined;
const cap = new Promise<'capped'>((resolve) => { capTimer = setTimeout(() => resolve('capped'), 3000); });
const hung = await Promise.race([
  bachsApi('sk_sandbox_k', hang, 50).getCheckoutSession('chk_1').then(() => 'resolved', (e) => { hangErr = e; return 'rejected'; }),
  cap,
]);
clearTimeout(capTimer);
ok(hung === 'rejected' && hangErr !== null && Date.now() - hangStart < 2000, 'a client built with a short timeout gives up on a Bachs call that hangs', String(hung));

console.log(failures === 0
  ? '\nPASS — Bachs: amounts, signatures, events and every grant rule behave.'
  : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
