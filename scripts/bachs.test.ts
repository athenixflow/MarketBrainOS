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

console.log(failures === 0
  ? '\nPASS — Bachs: amounts, signatures, events and every grant rule behave.'
  : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
