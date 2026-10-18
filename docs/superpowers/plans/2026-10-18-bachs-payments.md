# Bachs Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take real money through Bachs — USD plans as subscriptions, naira plans as 30-day passes, token packs in both — with a verified Bachs payment as the only thing that grants paid value.

**Architecture:** Pure, build-tested modules in `functions/src/bachs/` hold every rule (catalog, signature, event parsing, grant logic, API wrapper). `functions/src/index.ts` adds thin Firebase wrappers: `createCheckout` and `manageBilling` callables, the `bachsWebhook` endpoint, and three scheduled jobs. Subscription events are handled by fetching the subscription's current state from Bachs and syncing to it, so the webhook and the hourly reconciliation share one code path and delivery order cannot matter.

**Refinements of the spec, found while planning against the API docs:** (1) subscription events are not applied from the event body — the webhook fetches the subscription and syncs to its current state, which replaces the spec's `bachs_last_event_at` ordering check; (2) ledger keys are business identities (`checkout:{ref}`, `period:{sub}:{start}:{product}`, `end:{sub}`) because Bachs sends two events for one payment; (3) reconciliation is state-based (re-reads open checkouts and active subscriptions) because Bachs has no event-listing endpoint; (4) webhook health is detected from evidence — reconciliation having to grant something means the webhook missed it — because no endpoint-health API is documented.

**Tech Stack:** Firebase Cloud Functions v1 API (Node 22, TypeScript, `firebase-functions/v1`), Firestore Admin SDK, Bachs REST API v1 via `fetch`, React 18 + Vite client, build-wired `tsx` test scripts (the repo has no test framework; tests are scripts using an `ok(cond, label)` helper and `process.exit`).

**Spec:** `docs/superpowers/specs/2026-10-18-bachs-payments-design.md`

## Global Constraints

- Bachs replaces Paystack entirely; Paystack code is deleted in Task 11.
- Money crosses the Bachs boundary as **decimal strings in major units** (`"19.00"`, `"9900.00"`); inside our code it is always an integer in the **minor unit** (cents / kobo). Never a float in a stored amount.
- Naira prices are local, not converted: Pro ₦9,900 · Team ₦39,000 · Agency ₦120,000; packs Starter 100 ₦5,000 · Growth 500 ₦20,000 · Business 1,500 ₦50,000 · Agency 5,000 ₦150,000 · Enterprise 10,000 ₦250,000.
- `ngnPerUsd: 1450` lives in the pricing config and is used **only** to combine both currencies into one labelled figure; payments and reports keep the currency charged.
- USD plans are Bachs subscriptions; naira plans are one-off 30-day passes (`PASS_DAYS = 30`); early renewal of the same tier stacks; a lower pass is refused while a higher one is active.
- Token packs require the account to be on a paid plan (unchanged rule).
- The only code allowed to grant a paid tier, an allowance or a token credit: `bachsWebhook`, `bachsReconcile`, `manageBilling` (via the shared sync), and the admin callables. `scripts/grants.test.ts` enforces it.
- The **live** Bachs key is never used for development or tests. Locally the sandbox key lives in `functions/.secret.local` (gitignored by `*.local`); deployed keys live in Google Secret Manager (`BACHS_SECRET_KEY`, `BACHS_WEBHOOK_SECRET`).
- The repo is **public**: no key, no vendor commercial terms, no `study-data/` content in any commit.
- Every new build-wired test is shown failing on a planted bug before it is kept (repo rule).
- Paid extras (`purchaseExpansion`) stay closed; quarterly/annual billing, the overlay, and automated refunds are out of scope.

## Review Focus

1. **Bachs sends the signature timestamp in milliseconds, not seconds** — verification must still accept a fresh signature and reject a stale one. Test pinned in Task 3.
2. **An amount arrives as `"9900"`, `"9900.5"`, `9900` (a number) or `"9,900.00"`** — exact strings parse; a comma-formatted or negative value parses to `null` and the payment goes to review rather than being guessed. Test pinned in Task 2.
3. **The account is deleted between checkout and payment** — the payment is recorded for review; nothing throws, nothing is retried forever. Test pinned in Task 5.
4. **A customer pays a checkout our records already marked `expired`** (Bachs completes it late) — money was taken, so the grant still happens if the amount matches. Test pinned in Task 5.
5. **A customer opens two checkouts for the same pass in two tabs and pays both** — the second payment stacks another 30 days (60 in total) rather than being lost or double-counted in the same window. Test pinned in Task 5.

---

## File Structure

| File | Responsibility |
|---|---|
| `functions/src/bachs/catalog.ts` (new) | What is for sale and its exact minor-unit amount; major/minor conversion. Pure. |
| `functions/src/bachs/config.ts` (new) | Env-driven switches: `billingLive`, tier ↔ Bachs product id. Pure. |
| `functions/src/bachs/signature.ts` (new) | Webhook signature verification. Pure. |
| `functions/src/bachs/events.ts` (new) | Parse webhook events, subscriptions and checkout sessions into our shapes. Pure. |
| `functions/src/bachs/grant.ts` (new) | All grant rules: one-off payments, passes, subscription sync, pass expiry, reminders, checkout eligibility. Pure. |
| `functions/src/bachs/api.ts` (new) | Thin `fetch` wrapper over Bachs REST v1. |
| `functions/src/index.ts` (modify) | Pricing literal; Firebase wrappers for checkout, billing, webhook, scheduled jobs; remove Paystack. |
| `functions/src/email/templates.ts` (modify) | Currency-aware `money()`; `passReminder`, `passExpired`, `billingAlert`. |
| `config/pricingConfig.ts` (modify) | Client copy of naira prices and `ngnPerUsd`. |
| `services/billing.ts` (modify) | Client: default currency, `startCheckout`, `callManageBilling`, `canPay`. |
| `pages/Pricing.tsx`, `components/SubscriptionPanel.tsx`, `components/TokenStore.tsx` (modify) | ₦/$ toggle and checkout calls. |
| `firestore.rules` (modify) | Explicit server-only rules for `checkouts`, `payment_events`, `billing_reviews`. |
| `scripts/bachs.test.ts` (new) | Build-wired tests for every pure module. |
| `scripts/bachs/setup.ts` (new) | Creates the three USD products in a Bachs environment. |
| `scripts/pricing.test.ts`, `scripts/grants.test.ts` (modify) | Naira prices; grant allowlist. |
| `functions/src/paystack.ts`, `scripts/paystack.test.ts` (delete) | Retired. |

Shared test helper used by every block of `scripts/bachs.test.ts` (created in Task 2):

```ts
let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};
```

The file ends (always last) with:

```ts
console.log(failures === 0
  ? '\nPASS — Bachs: amounts, signatures, events and every grant rule behave.'
  : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
```

Each later task inserts its block **above** that ending and adds its imports to the top.

---

### Task 1: Naira prices and the exchange-rate setting in both pricing copies

**Files:**
- Modify: `config/pricingConfig.ts` (interfaces `PlanConfig`, `TokenPack`, `PricingConfig`; `DEFAULT_PRICING_CONFIG`)
- Modify: `functions/src/index.ts:95-150` (server interfaces, `DEFAULT_PRICING_CONFIG` literal, `mergePricingConfig`)
- Modify: `scripts/pricing.test.ts`
- Move the sandbox key: `functions/.env` → `functions/.secret.local`

**Interfaces:**
- Produces: `PlanConfig.priceNgn?: number` (whole naira), `TokenPack.priceNgn?: number`, `PricingConfig.ngnPerUsd: number`. Paid tiers pro/team/agency and all five packs carry `priceNgn`.

- [ ] **Step 1: Write the failing test** — append to `scripts/pricing.test.ts` just before its final summary `console.log`:

```ts
/* ============================================ naira prices (spec §2) */

console.log('\nNAIRA PRICES:');
const NGN_PLANS: Record<string, number> = { pro: 9900, team: 39000, agency: 120000 };
const NGN_PACKS: Record<string, number> = { starter: 5000, growth: 20000, business: 50000, agency: 150000, enterprise: 250000 };
for (const [tier, ngn] of Object.entries(NGN_PLANS)) {
  ok((CLIENT.plans as any)[tier]?.priceNgn === ngn, `client ${tier} is ₦${ngn.toLocaleString()}`);
  ok(new RegExp(`${tier}:\\s*\\{[^}]*priceNgn:\\s*${ngn}\\b`).test(serverSrc), `server ${tier} is ₦${ngn.toLocaleString()}`);
}
for (const [id, ngn] of Object.entries(NGN_PACKS)) {
  ok(CLIENT.tokenPacks.find((p) => p.id === id)?.priceNgn === ngn, `client ${id} pack is ₦${ngn.toLocaleString()}`);
  ok(new RegExp(`id:\\s*'${id}'[^}]*priceNgn:\\s*${ngn}\\b`).test(serverSrc), `server ${id} pack is ₦${ngn.toLocaleString()}`);
}
ok((CLIENT as any).ngnPerUsd === 1450 && /ngnPerUsd:\s*1450\b/.test(serverSrc), 'both copies carry ngnPerUsd: 1450');
/* The rule that already holds for dollars, in naira: no pack is cheaper per token than the
   Pro plan's allowance, or a pack would undercut the subscription it sits beside. */
const proNgnPerToken = NGN_PLANS.pro / CLIENT.plans.pro.monthlyTokens;
const cheapestPack = Math.min(...CLIENT.tokenPacks.map((p) => (p.priceNgn ?? Infinity) / p.tokens));
const proUsdPerToken = CLIENT.plans.pro.price / CLIENT.plans.pro.monthlyTokens;
const cheapestUsdPack = Math.min(...CLIENT.tokenPacks.map((p) => p.price / p.tokens));
ok(cheapestPack / proNgnPerToken >= (cheapestUsdPack / proUsdPerToken) * 0.95,
  'naira packs keep the same pack-to-plan ratio as dollar packs (within 5%)',
  `naira ${(cheapestPack / proNgnPerToken).toFixed(3)} vs dollar ${(cheapestUsdPack / proUsdPerToken).toFixed(3)}`);
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx tsx scripts/pricing.test.ts`
Expected: FAIL lines for every naira check, exit code 1.

- [ ] **Step 3: Add the fields to the client copy** — in `config/pricingConfig.ts`:

```ts
export interface PlanConfig {
  price: number;            // USD / month
  priceNgn?: number;        // naira for a 30-day pass (local price, not a conversion)
  monthlyTokens: number;    // included tokens that reset each cycle
  membersPerWorkspace?: number;
  workspaces?: number;
  agencies?: number;
  workspacesPerAgency?: number;
  maxMembers?: number;
}

export interface TokenPack { id: string; label: string; tokens: number; price: number; priceNgn?: number; }

export interface PricingConfig {
  plans: Record<Tier, PlanConfig>;
  expansion: { member: number; workspace: number; agency: number };
  tokenPacks: TokenPack[];
  toolCosts: Record<string, number>;
  analysisTiers: { standard: number; premium: number; advanced: number };
  renewalDays: number;
  /** Used ONLY to combine both currencies into one labelled figure. Prices are never converted. */
  ngnPerUsd: number;
}
```

and in `DEFAULT_PRICING_CONFIG` set exactly:

```ts
    pro:        { price: 19,  priceNgn: 9900,   monthlyTokens: 300 },
    team:       { price: 79,  priceNgn: 39000,  monthlyTokens: 600,   membersPerWorkspace: 5 },
    agency:     { price: 199, priceNgn: 120000, monthlyTokens: 2000,  workspaces: 5,  membersPerWorkspace: 10, maxMembers: 50 },
```

(keep `free` and `enterprise` lines unchanged),

```ts
  tokenPacks: [
    { id: 'starter',    label: 'Starter Pack',    tokens: 100,   price: 10,  priceNgn: 5000 },
    { id: 'growth',     label: 'Growth Pack',     tokens: 500,   price: 40,  priceNgn: 20000 },
    { id: 'business',   label: 'Business Pack',   tokens: 1500,  price: 100, priceNgn: 50000 },
    { id: 'agency',     label: 'Agency Pack',     tokens: 5000,  price: 300, priceNgn: 150000 },
    { id: 'enterprise', label: 'Enterprise Pack', tokens: 10000, price: 500, priceNgn: 250000 },
  ],
```

and after `renewalDays: 30,` add `ngnPerUsd: 1450,`.

- [ ] **Step 4: Mirror it in the server copy** — in `functions/src/index.ts` make the same three edits to its `PlanConfig`, `TokenPack`, `PricingConfig` interfaces and `DEFAULT_PRICING_CONFIG` literal (identical values), and in `mergePricingConfig` add to the returned object:

```ts
    ngnPerUsd: typeof over.ngnPerUsd === 'number' && over.ngnPerUsd > 0 ? over.ngnPerUsd : base.ngnPerUsd,
```

- [ ] **Step 5: Run the test to see it pass, and typecheck both packages**

Run: `npx tsx scripts/pricing.test.ts && (cd functions && npx tsc --noEmit -p .) && npx tsc`
Expected: `PASS — …` and both `tsc` runs print nothing.

- [ ] **Step 6: Move the sandbox key out of `.env`** (Firebase refuses to deploy a name that is both a plain env var and a secret). Without printing the value:

```bash
cd functions && node -e "
const fs=require('fs');
const lines=fs.readFileSync('.env','utf8').split(/\r?\n/);
const keep=lines.filter(l=>!l.startsWith('BACHS_SECRET_KEY='));
const key=lines.find(l=>l.startsWith('BACHS_SECRET_KEY='));
if(!key) throw new Error('no BACHS_SECRET_KEY in .env');
fs.appendFileSync('.secret.local', key+'\n');
fs.writeFileSync('.env', keep.join('\n'));
console.log('moved; .secret.local now has', fs.readFileSync('.secret.local','utf8').split('\n').filter(Boolean).length, 'line(s)');"
cd .. && git check-ignore -q functions/.secret.local && echo ignored
```

Expected: `moved; …` then `ignored`.

- [ ] **Step 7: Commit**

```bash
git add config/pricingConfig.ts functions/src/index.ts scripts/pricing.test.ts
git commit -m "Pricing: naira pass and pack prices, and the ₦1,450/$ reporting rate, in both copies"
```

---

### Task 2: The catalog — what is for sale, for exactly how much

**Files:**
- Create: `functions/src/bachs/catalog.ts`
- Create: `functions/src/bachs/config.ts`
- Create: `scripts/bachs.test.ts`
- Modify: `package.json` (`build` script and a `test:bachs` script)

**Interfaces:**
- Consumes: `PricingConfig` shape from Task 1 (structurally, as `PricingLike`).
- Produces:
  - `type Currency = 'USD' | 'NGN'`, `type Kind = 'plan' | 'pass' | 'pack'`, `type PaidTier = 'pro' | 'team' | 'agency'`
  - `PAID_TIERS: readonly PaidTier[]`, `TIER_RANK: Record<string, number>`
  - `interface PricingLike`, `interface CatalogItem { kind; item; currency; amountMinor: number; label: string; tokens: number; tier: PaidTier | null }`
  - `catalogItem(cfg: PricingLike, kind: Kind, item: string, currency: Currency): CatalogItem | null`
  - `toMajorString(amountMinor: number): string`, `toMinor(v: unknown): number | null`
  - from `config.ts`: `billingLive(env)`, `productForTier(tier, env): string | null`, `tierForProduct(productId, env): PaidTier | null`

- [ ] **Step 1: Write the failing test** — create `scripts/bachs.test.ts`:

```ts
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

console.log(failures === 0
  ? '\nPASS — Bachs: amounts, signatures, events and every grant rule behave.'
  : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx tsx scripts/bachs.test.ts`
Expected: `Cannot find module '../functions/src/bachs/catalog'`.

- [ ] **Step 3: Implement `functions/src/bachs/catalog.ts`**

```ts
/**
 * What can be bought, and for exactly how much (spec §3, §5).
 *
 * PURE. The pricing config is passed in rather than imported: the server's copy is a literal
 * inside index.ts, which loads the Admin SDK and cannot be imported by a build-time test, and
 * scripts/pricing.test.ts already proves the client copy equals it.
 *
 * MINOR UNITS INSIDE, DECIMAL STRINGS AT THE BOUNDARY. Bachs takes and returns "19.00"; we
 * store 1900. Converting through floats is how a kobo goes missing, so both directions are
 * exact string/integer arithmetic.
 */

export type Currency = 'USD' | 'NGN';
export type Kind = 'plan' | 'pass' | 'pack';
export type PaidTier = 'pro' | 'team' | 'agency';

export const PAID_TIERS: readonly PaidTier[] = ['pro', 'team', 'agency'];
export const TIER_RANK: Record<string, number> = { free: 0, pro: 1, team: 2, agency: 3, enterprise: 4 };

export interface PricingLike {
  plans: Record<string, { price: number; priceNgn?: number; monthlyTokens: number }>;
  tokenPacks: Array<{ id: string; label: string; tokens: number; price: number; priceNgn?: number }>;
}

export interface CatalogItem {
  kind: Kind;
  item: string;
  currency: Currency;
  /** Cents for USD, kobo for NGN. */
  amountMinor: number;
  label: string;
  /** Monthly allowance for a plan or pass; pack size for a pack. */
  tokens: number;
  tier: PaidTier | null;
}

const isPaidTier = (s: string): s is PaidTier => (PAID_TIERS as readonly string[]).includes(s);
const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Config prices are whole units (19, 9900), so ×100 is exact. */
const toMinorWhole = (major: number) => Math.round(major * 100);

export const catalogItem = (cfg: PricingLike, kind: Kind, item: string, currency: Currency): CatalogItem | null => {
  if (kind === 'plan') {
    /* Bachs bills subscriptions in USD only (NGN_SUBSCRIPTIONS_NOT_ENABLED). */
    if (currency !== 'USD' || !isPaidTier(item)) return null;
    const p = cfg.plans[item];
    if (!p || !(p.price > 0)) return null;
    return { kind, item, currency, amountMinor: toMinorWhole(p.price), label: `${title(item)} plan, monthly`, tokens: p.monthlyTokens, tier: item };
  }
  if (kind === 'pass') {
    if (currency !== 'NGN' || !isPaidTier(item)) return null;
    const p = cfg.plans[item];
    if (!p || !(Number(p.priceNgn) > 0)) return null;
    return { kind, item, currency, amountMinor: toMinorWhole(p.priceNgn as number), label: `${title(item)}, 30 days`, tokens: p.monthlyTokens, tier: item };
  }
  if (kind === 'pack') {
    const pack = cfg.tokenPacks.find((x) => x.id === item);
    if (!pack) return null;
    const price = currency === 'USD' ? pack.price : pack.priceNgn;
    if (!(Number(price) > 0)) return null;
    return { kind, item, currency, amountMinor: toMinorWhole(price as number), label: pack.label, tokens: pack.tokens, tier: null };
  }
  return null;
};

/** 1900 → "19.00". Refuses anything that is not a whole non-negative minor amount. */
export const toMajorString = (amountMinor: number): string => {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) throw new Error(`not a minor amount: ${amountMinor}`);
  return `${Math.floor(amountMinor / 100)}.${String(amountMinor % 100).padStart(2, '0')}`;
};

/** "19.00" / "9900" / 19 → minor units; anything else (commas, negatives, 3 decimals) → null. */
export const toMinor = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0'));
};
```

- [ ] **Step 4: Implement `functions/src/bachs/config.ts`**

```ts
import { PAID_TIERS, PaidTier } from './catalog';

/**
 * Environment-driven switches (spec §3). One place, read by every function and by the client
 * through `billingStatus`, so the buttons and the server cannot disagree.
 *
 * Absent key means NOT LIVE whatever the flag says: a Pay button that cannot charge is worse
 * than one that says "coming soon".
 */
export const billingLive = (env: Record<string, string | undefined>): boolean =>
  Boolean(env.BACHS_SECRET_KEY) && env.BILLING_LIVE === 'true';

/** Bachs product ids differ between sandbox and live, so they arrive as env vars. */
export const productForTier = (tier: PaidTier, env: Record<string, string | undefined>): string | null =>
  env[`BACHS_PRODUCT_${tier.toUpperCase()}`] || null;

/** An unrecognised product grants NOTHING — a dashboard typo must fail closed. */
export const tierForProduct = (productId: string | null, env: Record<string, string | undefined>): PaidTier | null => {
  if (!productId) return null;
  return PAID_TIERS.find((t) => productForTier(t, env) === productId) ?? null;
};
```

- [ ] **Step 5: Run the test to see it pass**

Run: `npx tsx scripts/bachs.test.ts`
Expected: every line `PASS`, final `PASS — Bachs: …`.

- [ ] **Step 6: Negative control** — temporarily change `toMinorWhole` to `Math.floor(major * 100) - 1`, run the test, confirm `FAIL  Pro plan is 1900 cents`, then revert and re-run to `PASS`.

- [ ] **Step 7: Wire into the build** — in `package.json`, insert `tsx scripts/bachs.test.ts && ` immediately before `tsx scripts/pdf.test.ts` in `build`, and add `"test:bachs": "tsx scripts/bachs.test.ts",` next to `"test:grants"`. Then run `node scripts/deploy.test.mjs` — expected `PASS — everything the build loads is installed by the root npm install Vercel runs.`

- [ ] **Step 8: Typecheck functions and commit**

```bash
(cd functions && npx tsc --noEmit -p .)
git add functions/src/bachs/catalog.ts functions/src/bachs/config.ts scripts/bachs.test.ts package.json
git commit -m "Bachs catalog: what is for sale, in exact minor units, and the live switch"
```

---

### Task 3: Webhook signature verification

**Files:**
- Create: `functions/src/bachs/signature.ts`
- Modify: `scripts/bachs.test.ts` (new block + import)

**Interfaces:**
- Produces: `BACHS_SIGNATURE_HEADER = 'x-bachs-signature-v2'`, `SIGNATURE_TOLERANCE_SECONDS = 300`, `parseSignatureHeader(h): { t: number; tRaw: string; v1: string[] } | null`, `signPayload(secret, tRaw, rawBody): string`, `verifyBachsSignature(rawBody: string | Buffer, header: string | string[] | undefined, secret: string | undefined, nowSeconds?: number): boolean`

- [ ] **Step 1: Write the failing test** — add the import `import { signPayload, verifyBachsSignature } from '../functions/src/bachs/signature';` and insert:

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx tsx scripts/bachs.test.ts`
Expected: `Cannot find module '../functions/src/bachs/signature'`.

- [ ] **Step 3: Implement `functions/src/bachs/signature.ts`**

```ts
import * as crypto from 'crypto';

/**
 * Is this webhook really from Bachs? (spec §3, §6)
 *
 * Bachs signs "{t}.{raw body}" with HMAC-SHA256 and sends `X-Bachs-Signature-V2: t=…,v1=…`,
 * with one v1 per valid secret during rotation. Three rules, each with a failure in mind:
 *
 *   RAW BYTES ONLY. A re-serialised body (JSON.stringify of the parsed request) can differ in
 *   key order or number format and fail honest requests — the usual "fix" is to skip the check.
 *   THE TIMESTAMP AS SENT. The signed string uses the header's own text for t, not a number
 *   re-printed by us.
 *   FRESHNESS. A signature more than 300s from now is refused, so a captured request cannot be
 *   replayed later. Bachs documents t in seconds; milliseconds are tolerated rather than trusted
 *   to never happen.
 */
export const BACHS_SIGNATURE_HEADER = 'x-bachs-signature-v2';
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export const parseSignatureHeader = (header: string | string[] | undefined): { t: number; tRaw: string; v1: string[] } | null => {
  const h = Array.isArray(header) ? header[0] : header;
  if (!h) return null;
  let tRaw = '';
  const v1: string[] = [];
  for (const part of h.split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === 't') tRaw = v;
    else if (k === 'v1' && /^[0-9a-f]+$/i.test(v)) v1.push(v.toLowerCase());
  }
  const t = Number(tRaw);
  if (!tRaw || !Number.isFinite(t) || v1.length === 0) return null;
  return { t, tRaw, v1 };
};

export const signPayload = (secret: string, tRaw: string, rawBody: string | Buffer): string =>
  crypto.createHmac('sha256', secret)
    .update(`${tRaw}.`)
    .update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody)
    .digest('hex');

export const verifyBachsSignature = (
  rawBody: string | Buffer,
  header: string | string[] | undefined,
  secret: string | undefined,
  nowSeconds: number = Date.now() / 1000,
): boolean => {
  if (!secret) return false;
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;
  const tSeconds = parsed.t > 1e12 ? parsed.t / 1000 : parsed.t;
  if (Math.abs(nowSeconds - tSeconds) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(signPayload(secret, parsed.tRaw, rawBody), 'utf8');
  /* Timing-safe: a plain === leaks through its duration how much of a guess was right. */
  return parsed.v1.some((sig) => {
    const b = Buffer.from(sig, 'utf8');
    return b.length === expected.length && crypto.timingSafeEqual(b, expected);
  });
};
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx tsx scripts/bachs.test.ts` — Expected: all `PASS`.

- [ ] **Step 5: Negative control** — temporarily change `> SIGNATURE_TOLERANCE_SECONDS` to `> 1e9`; confirm both replay checks FAIL; revert; re-run to `PASS`.

- [ ] **Step 6: Commit**

```bash
(cd functions && npx tsc --noEmit -p .)
git add functions/src/bachs/signature.ts scripts/bachs.test.ts
git commit -m "Bachs webhook signature: raw bytes, timing-safe, 300s window, rotation"
```

---

### Task 4: Parsing events, subscriptions and checkout sessions

**Files:**
- Create: `functions/src/bachs/events.ts`
- Modify: `scripts/bachs.test.ts`

**Interfaces:**
- Consumes: `toMinor` (Task 2).
- Produces:
  - `type BachsEventKind = 'one_off_paid' | 'subscription_linked' | 'subscription_changed' | 'review'`
  - `interface BachsEvent { id; type; createdAt; kind; reference: string | null; metadata: Record<string, string>; amountMinor: number | null; currency: string | null; checkoutId: string | null; customerId: string | null; subscriptionId: string | null }`
  - `parseBachsEvent(body: unknown): BachsEvent | null`
  - `interface SubscriptionSnapshot { id; status: string; productId: string | null; customerId: string | null; currency: string | null; amountMinor: number | null; currentPeriodStart: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; metadata: Record<string, string> }`
  - `parseSubscription(raw: unknown): SubscriptionSnapshot | null`
  - `interface CheckoutSnapshot { id; reference: string | null; paid: boolean; expired: boolean; mode: string | null; amountMinor: number | null; currency: string | null; subscriptionId: string | null; customerId: string | null }`
  - `parseCheckoutSession(raw: unknown): CheckoutSnapshot | null`

- [ ] **Step 1: Write the failing test** — add `import { parseBachsEvent, parseCheckoutSession, parseSubscription } from '../functions/src/bachs/events';` and insert:

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx tsx scripts/bachs.test.ts` — Expected: `Cannot find module '../functions/src/bachs/events'`.

- [ ] **Step 3: Implement `functions/src/bachs/events.ts`**

```ts
import { toMinor } from './catalog';

/**
 * Bachs payloads, read into the shapes our grant rules use (spec §3, §6).
 *
 * DEFENSIVE BY DEFAULT. This runs on input from the public internet that has passed a
 * signature check and nothing else. A missing or odd field is a null, never a throw: an
 * exception here is a 500, and Bachs retries a 500 — one malformed event becomes a retry storm.
 *
 * Field names follow docs.bachs.io as of 2026-10. Where the docs are silent the parser accepts
 * the plausible alternatives (`subscription` as an id or an object, `amount` vs `amount_paid`),
 * and the sandbox run in Task 14 confirms which one Bachs actually sends.
 */

export type BachsEventKind = 'one_off_paid' | 'subscription_linked' | 'subscription_changed' | 'review';

export interface BachsEvent {
  id: string;
  type: string;
  createdAt: string;
  kind: BachsEventKind;
  reference: string | null;
  metadata: Record<string, string>;
  amountMinor: number | null;
  currency: string | null;
  checkoutId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
}

export interface SubscriptionSnapshot {
  id: string;
  status: string;
  productId: string | null;
  customerId: string | null;
  currency: string | null;
  amountMinor: number | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  metadata: Record<string, string>;
}

export interface CheckoutSnapshot {
  id: string;
  reference: string | null;
  paid: boolean;
  expired: boolean;
  mode: string | null;
  amountMinor: number | null;
  currency: string | null;
  subscriptionId: string | null;
  customerId: string | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const idOf = (v: unknown): string | null =>
  str(v) ?? (v && typeof v === 'object' ? str((v as Record<string, unknown>).id) : null);
const upper = (v: unknown): string | null => str(v)?.toUpperCase() ?? null;
const meta = (v: unknown): Record<string, string> =>
  v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, String(x)]))
    : {};
const unwrap = (raw: unknown): Record<string, any> | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;
  return r.data && typeof r.data === 'object' && !r.id && !r.checkout_id ? r.data : r;
};

export const parseBachsEvent = (body: unknown): BachsEvent | null => {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, any>;
  const id = str(b.id);
  const type = str(b.type);
  const d = b.data;
  if (!id || !type || !d || typeof d !== 'object') return null;

  const base = {
    id,
    type,
    createdAt: str(b.created_at) ?? '',
    reference: str(d.reference),
    metadata: meta(d.metadata),
    amountMinor: toMinor(d.amount ?? d.amount_paid ?? d.total),
    currency: upper(d.currency),
    checkoutId: str(d.checkout_id) ?? (type.startsWith('checkout.') ? str(d.id) : null),
    customerId: idOf(d.customer) ?? str(d.customer_id),
    subscriptionId: str(d.subscription_id) ?? idOf(d.subscription)
      ?? (type.startsWith('customer.subscription.') ? str(d.id) : null),
  };

  if (type === 'checkout.completed') {
    if (d.mode === 'subscription') return { ...base, kind: 'subscription_linked' };
    if (d.mode === 'payment' && d.payment_status === 'paid') return { ...base, kind: 'one_off_paid' };
    return null;
  }
  if (type === 'collection.succeeded') {
    /* A renewal's collection carries no checkout reference; invoice.paid → subscription sync covers it. */
    if (!base.reference) return null;
    return ['SUCCEEDED', 'ACCEPTED', 'OVERPAID'].includes(String(d.status).toUpperCase())
      ? { ...base, kind: 'one_off_paid' } : null;
  }
  if (type === 'invoice.paid' || type === 'invoice.payment_failed' || type.startsWith('customer.subscription.')) {
    return base.subscriptionId ? { ...base, kind: 'subscription_changed' } : null;
  }
  if (type.startsWith('refund.') || type.startsWith('dispute.')) return { ...base, kind: 'review' };
  return null;
};

export const parseSubscription = (raw: unknown): SubscriptionSnapshot | null => {
  const s = unwrap(raw);
  if (!s) return null;
  const id = str(s.id) ?? str(s.subscription_id);
  if (!id) return null;
  return {
    id,
    status: String(s.status || '').toLowerCase(),
    productId: str(s.product_id) ?? idOf(s.product) ?? str(s.items?.[0]?.product_id),
    customerId: idOf(s.customer) ?? str(s.customer_id),
    currency: upper(s.currency ?? s.price?.currency),
    amountMinor: toMinor(s.amount ?? s.price?.amount),
    currentPeriodStart: str(s.current_period_start),
    currentPeriodEnd: str(s.current_period_end),
    cancelAtPeriodEnd: s.cancel_at_period_end === true,
    metadata: meta(s.metadata),
  };
};

export const parseCheckoutSession = (raw: unknown): CheckoutSnapshot | null => {
  const c = unwrap(raw);
  if (!c) return null;
  const id = str(c.checkout_id) ?? str(c.id);
  if (!id) return null;
  const status = String(c.status || '').toLowerCase();
  return {
    id,
    reference: str(c.reference),
    paid: c.payment_status === 'paid' || ['completed', 'complete', 'paid'].includes(status),
    expired: status === 'expired',
    mode: str(c.mode),
    amountMinor: toMinor(c.amount ?? c.pricing?.amount ?? c.amount_total),
    currency: upper(c.currency ?? c.pricing?.currency),
    subscriptionId: idOf(c.subscription) ?? str(c.subscription_id),
    customerId: idOf(c.customer) ?? str(c.customer_id),
  };
};
```

- [ ] **Step 4: Run the test to see it pass** — `npx tsx scripts/bachs.test.ts`, all `PASS`.

- [ ] **Step 5: Negative control** — temporarily delete the `if (!base.reference) return null;` line; confirm `FAIL  a collection with no reference (a renewal) is left to invoice.paid`; revert; `PASS`.

- [ ] **Step 6: Commit**

```bash
(cd functions && npx tsc --noEmit -p .)
git add functions/src/bachs/events.ts scripts/bachs.test.ts
git commit -m "Bachs events: parse webhooks, subscriptions and checkout sessions defensively"
```

---

### Task 5: Grant rules — one-off payments, passes, packs, expiry, reminders, eligibility

**Files:**
- Create: `functions/src/bachs/grant.ts`
- Modify: `scripts/bachs.test.ts`

**Interfaces:**
- Consumes: `catalogItem`, `TIER_RANK`, `PricingLike`, `Kind`, `Currency` (Task 2); `BachsEvent` (Task 4).
- Produces:
  - `PASS_DAYS = 30`
  - `interface Account { tier?; monthly_tokens?; purchased_tokens?; tokens?; billing_mode?: 'subscription' | 'pass' | null; pass_expires_at?: string | null; pass_reminded?: number[]; subscription_status?: string; bachs_subscription_id?: string | null; bachs_customer_id?: string | null }`
  - `interface CheckoutRecord { uid: string; kind: Kind; item: string; currency: Currency; amount_minor: number; status: string }`
  - `interface PaymentRecord { kind: Kind; item: string; amount_minor: number; currency: string; tokens_credited: number }`
  - `interface GrantResult { ledgerKey: string | null; userUpdate: Record<string, unknown> | null; payment: PaymentRecord | null; review: string | null; checkoutStatus: 'paid' | 'review' | null }`
  - `balances(a: Account): { monthly: number; purchased: number }`, `balanceFields(monthly, purchased)`
  - `checkoutAllowed(a: Account, kind: Kind, item: string, nowIso: string): { ok: true } | { ok: false; reason: string }`
  - `applyOneOff(account: Account | null, checkout: CheckoutRecord | null, event: Pick<BachsEvent, 'reference' | 'amountMinor' | 'currency'>, cfg: PricingLike, nowIso: string): GrantResult`
  - `expirePass(a: Account, nowIso: string): Record<string, unknown> | null`
  - `reminderDue(a: Account, nowIso: string): 5 | 1 | null`

- [ ] **Step 1: Write the failing test** — add `import { applyOneOff, checkoutAllowed, expirePass, reminderDue, PASS_DAYS } from '../functions/src/bachs/grant';` and insert:

```ts
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
const twoTabs = applyOneOff(proPass(day(30)), checkout('pass', 'pro', 'NGN', 990000), pay(990000), CFG, T0);
ok(twoTabs.userUpdate?.pass_expires_at === day(60), 'two payments for the same pass stack to 60 days (Review Focus 5)');
const up = applyOneOff(proPass(day(20)), checkout('pass', 'team', 'NGN', 3900000), pay(3900000), CFG, T0);
ok(up.userUpdate?.tier === 'team' && up.userUpdate?.pass_expires_at === day(30), 'an upgrade mid-pass starts a fresh 30 days of the new tier');
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

console.log('\nPASS LIFECYCLE:');
ok(reminderDue(proPass(day(4.5)), T0) === 5 && reminderDue({ ...proPass(day(4.5)), pass_reminded: [5] }, T0) === null, '5-day reminder once');
ok(reminderDue({ ...proPass(day(0.5)), pass_reminded: [5] }, T0) === 1, '1-day reminder');
ok(reminderDue(proPass(day(10)), T0) === null && reminderDue(usdSub, T0) === null, 'no reminder early, or for a subscription');
const exp = expirePass(proPass(day(-0.1)), T0);
ok(exp?.tier === 'free' && exp?.monthly_tokens === 0 && exp?.purchased_tokens === 7 && exp?.subscription_status === 'expired',
  'an ended pass → Free, allowance 0, purchased tokens kept');
ok(expirePass(proPass(day(1)), T0) === null && expirePass(usdSub, T0) === null, 'an active pass or a subscription is not expired');
```

- [ ] **Step 2: Run it to see it fail** — `npx tsx scripts/bachs.test.ts`; expected `Cannot find module '../functions/src/bachs/grant'`.

- [ ] **Step 3: Implement `functions/src/bachs/grant.ts`** (Task 6 appends to this file)

```ts
import { Currency, Kind, PricingLike, TIER_RANK, catalogItem } from './catalog';
import { BachsEvent } from './events';

/**
 * EVERY RULE THAT GRANTS PAID VALUE (spec §5). Pure: the account, the checkout record and the
 * payment go in; the changes come out. index.ts reads, calls these, and writes the result with
 * the ledger entry in one transaction — so a rule can be proved here and cannot be bypassed there.
 */

export const PASS_DAYS = 30;
const DAY_MS = 86_400_000;

export interface Account {
  tier?: string;
  monthly_tokens?: number;
  purchased_tokens?: number;
  tokens?: number;
  billing_mode?: 'subscription' | 'pass' | null;
  pass_expires_at?: string | null;
  pass_reminded?: number[];
  subscription_status?: string;
  bachs_subscription_id?: string | null;
  bachs_customer_id?: string | null;
}

export interface CheckoutRecord {
  uid: string;
  kind: Kind;
  item: string;
  currency: Currency;
  amount_minor: number;
  status: string;
}

export interface PaymentRecord {
  kind: Kind;
  item: string;
  amount_minor: number;
  currency: string;
  tokens_credited: number;
}

export interface GrantResult {
  /** The once-only key; null = nothing to record (the event is not ours to act on). */
  ledgerKey: string | null;
  userUpdate: Record<string, unknown> | null;
  payment: PaymentRecord | null;
  /** Why nothing was granted, for a human. */
  review: string | null;
  checkoutStatus: 'paid' | 'review' | null;
}

const NONE: GrantResult = { ledgerKey: null, userUpdate: null, payment: null, review: null, checkoutStatus: null };

/** Mirrors readBalances in index.ts: a legacy bare `tokens` is the monthly balance. */
export const balances = (a: Account): { monthly: number; purchased: number } => ({
  monthly: typeof a.monthly_tokens === 'number' ? a.monthly_tokens : (typeof a.tokens === 'number' ? a.tokens : 0),
  purchased: typeof a.purchased_tokens === 'number' ? a.purchased_tokens : 0,
});

/** Mirrors balanceFields in index.ts, including the legacy `tokens` total. */
export const balanceFields = (monthly: number, purchased: number) => {
  const m = Math.max(0, Math.round(monthly));
  const p = Math.max(0, Math.round(purchased));
  return { monthly_tokens: m, purchased_tokens: p, tokens: m + p };
};

const rank = (tier: string | undefined) => TIER_RANK[tier || 'free'] ?? 0;
const activePass = (a: Account, nowMs: number) =>
  a.billing_mode === 'pass' && !!a.pass_expires_at && Date.parse(a.pass_expires_at) > nowMs;
const activeSubscription = (a: Account) =>
  a.billing_mode === 'subscription' && ['active', 'past_due', 'cancelled'].includes(String(a.subscription_status));

export const checkoutAllowed = (a: Account, kind: Kind, item: string, nowIso: string): { ok: true } | { ok: false; reason: string } => {
  const nowMs = Date.parse(nowIso);
  const refuse = (reason: string) => ({ ok: false as const, reason });
  if (kind === 'pack') return rank(a.tier) >= 1 ? { ok: true } : refuse('Token packs are available on a paid plan.');
  if (kind === 'plan') {
    if (activePass(a, nowMs)) return refuse('You have an active naira pass. Pay in dollars once it ends, or renew the pass.');
    if (activeSubscription(a)) return refuse('You already have a dollar subscription. Change plan from Billing.');
    return { ok: true };
  }
  if (activeSubscription(a)) return refuse('You have a dollar subscription. Cancel it before switching to a naira pass.');
  if (activePass(a, nowMs) && rank(item) < rank(a.tier)) {
    return refuse(`Your ${a.tier} pass is still active; a lower plan can be bought when it ends.`);
  }
  return { ok: true };
};

export const applyOneOff = (
  account: Account | null,
  checkout: CheckoutRecord | null,
  event: Pick<BachsEvent, 'reference' | 'amountMinor' | 'currency'>,
  cfg: PricingLike,
  nowIso: string,
): GrantResult => {
  if (!event.reference) return NONE;
  const ledgerKey = `checkout:${event.reference}`;
  const review = (why: string): GrantResult => ({ ...NONE, ledgerKey, review: why, checkoutStatus: checkout ? 'review' : null });

  if (!checkout) return review('payment for a reference we never issued');
  /* A subscription's first payment also fires one-off events; the subscription sync grants it. */
  if (checkout.kind === 'plan') return NONE;
  if (!account) return review('the account no longer exists');
  const item = catalogItem(cfg, checkout.kind, checkout.item, checkout.currency);
  if (!item) return review(`${checkout.kind} ${checkout.item} ${checkout.currency} is no longer for sale`);
  if (event.amountMinor !== checkout.amount_minor || (event.currency ?? '') !== checkout.currency) {
    return review(`paid ${event.amountMinor ?? 'unreadable'} ${event.currency ?? '?'}, expected ${checkout.amount_minor} ${checkout.currency}`);
  }

  const { monthly, purchased } = balances(account);
  const payment: PaymentRecord = {
    kind: checkout.kind, item: checkout.item, amount_minor: checkout.amount_minor,
    currency: checkout.currency, tokens_credited: item.tokens,
  };

  if (checkout.kind === 'pack') {
    return { ledgerKey, payment, review: null, checkoutStatus: 'paid', userUpdate: balanceFields(monthly, purchased + item.tokens) };
  }

  /* pass */
  const nowMs = Date.parse(nowIso);
  if (activeSubscription(account)) return review('naira pass paid while a dollar subscription is active');
  const passOn = activePass(account, nowMs);
  if (passOn && rank(account.tier) > rank(checkout.item)) return review('lower pass paid while a higher pass is active');
  const from = passOn && account.tier === checkout.item ? Date.parse(account.pass_expires_at as string) : nowMs;
  const expires = new Date(from + PASS_DAYS * DAY_MS).toISOString();
  return {
    ledgerKey, payment, review: null, checkoutStatus: 'paid',
    userUpdate: {
      tier: checkout.item,
      billing_mode: 'pass',
      billing_currency: 'NGN',
      subscription_status: 'active',
      pass_expires_at: expires,
      plan_renews_at: expires,
      pass_reminded: [],
      ...balanceFields(item.tokens, purchased),
    },
  };
};

export const reminderDue = (a: Account, nowIso: string): 5 | 1 | null => {
  if (a.billing_mode !== 'pass' || !a.pass_expires_at) return null;
  const daysLeft = (Date.parse(a.pass_expires_at) - Date.parse(nowIso)) / DAY_MS;
  const sent = Array.isArray(a.pass_reminded) ? a.pass_reminded : [];
  if (daysLeft <= 0) return null;
  if (daysLeft <= 1 && !sent.includes(1)) return 1;
  if (daysLeft <= 5 && !sent.includes(5)) return 5;
  return null;
};

export const expirePass = (a: Account, nowIso: string): Record<string, unknown> | null => {
  if (a.billing_mode !== 'pass' || !a.pass_expires_at) return null;
  if (Date.parse(a.pass_expires_at) > Date.parse(nowIso)) return null;
  return {
    tier: 'free',
    billing_mode: null,
    subscription_status: 'expired',
    pass_expires_at: null,
    ...balanceFields(0, balances(a).purchased),
  };
};
```

- [ ] **Step 4: Run the test to see it pass** — `npx tsx scripts/bachs.test.ts`, all `PASS`.

- [ ] **Step 5: Negative controls** — one at a time, revert after each: (a) in `applyOneOff` change `account.tier === checkout.item ? Date.parse(...)` to always `nowMs` → the 35-day and 60-day checks FAIL; (b) delete the amount-mismatch `if` → three mismatch checks FAIL.

- [ ] **Step 6: Commit**

```bash
(cd functions && npx tsc --noEmit -p .)
git add functions/src/bachs/grant.ts scripts/bachs.test.ts
git commit -m "Bachs grants: one-off passes and packs, stacking, review cases, eligibility, expiry"
```

---

### Task 6: Grant rules — syncing a USD subscription

**Files:**
- Modify: `functions/src/bachs/grant.ts` (append)
- Modify: `scripts/bachs.test.ts`

**Interfaces:**
- Consumes: `SubscriptionSnapshot` (Task 4), `PaidTier`, `catalogItem` (Task 2).
- Produces:
  - `interface SyncResult { stateUpdate: Record<string, unknown>; grant: GrantResult }`
  - `syncSubscription(account: Account, snap: SubscriptionSnapshot, tier: PaidTier | null, cfg: PricingLike, chargedMinor: number | null): SyncResult`
  - Ledger keys: `period:{subId}:{currentPeriodStart}:{productId}` for a paid period; `end:{subId}` for the end.

- [ ] **Step 1: Write the failing test** — extend the grant import with `syncSubscription`, and insert:

```ts
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
ok(upgraded.grant.ledgerKey?.endsWith(':prod_t') && upgraded.grant.userUpdate?.tier === 'team' && upgraded.grant.payment?.amount_minor === 6000,
  'an upgrade in the same period is a new key; the prorated charge is recorded as charged');
const recon = syncSubscription({ tier: 'pro' }, snap() as any, 'pro', CFG, null);
ok(recon.grant.payment?.amount_minor === 1900, 'reconciliation without an invoice records the plan price');
const cancelling = syncSubscription({ tier: 'pro' }, snap({ cancelAtPeriodEnd: true }) as any, 'pro', CFG, null);
ok(cancelling.stateUpdate.subscription_status === 'cancelled', 'cancel at period end → cancelled, access kept');
const pastDue = syncSubscription({ tier: 'pro' }, snap({ status: 'past_due' }) as any, 'pro', CFG, null);
ok(pastDue.stateUpdate.subscription_status === 'past_due' && pastDue.grant.ledgerKey === null, 'past due changes status only');
const ended = syncSubscription({ tier: 'pro', purchased_tokens: 9 }, snap({ status: 'canceled' }) as any, 'pro', CFG, null);
ok(ended.grant.ledgerKey === 'end:sub_1' && ended.grant.userUpdate?.tier === 'free' && ended.grant.userUpdate?.monthly_tokens === 0
  && ended.grant.userUpdate?.purchased_tokens === 9 && ended.grant.userUpdate?.billing_mode === null, 'ended → Free once, purchased tokens kept');
ok(syncSubscription({ tier: 'pro' }, snap({ status: 'unpaid' }) as any, 'pro', CFG, null).grant.ledgerKey === 'end:sub_1', 'unpaid ends it too');
ok(syncSubscription({}, snap() as any, null, CFG, 1900).grant.review !== null, 'an unknown product goes to review');
ok(syncSubscription({}, snap({ amountMinor: 100 }) as any, 'pro', CFG, 100).grant.review !== null, 'a product billing the wrong amount goes to review');
ok(syncSubscription({}, snap({ status: 'trialing' }) as any, 'pro', CFG, null).grant.ledgerKey === null, 'a trial grants nothing (trials are not sold)');
```

- [ ] **Step 2: Run it to see it fail** — expected: `syncSubscription is not a function` / import error.

- [ ] **Step 3: Append to `functions/src/bachs/grant.ts`**

```ts
/* ===================================================== USD subscriptions */

export interface SyncResult {
  /** Always applied: status, renewal date, ids. Idempotent field sets. */
  stateUpdate: Record<string, unknown>;
  /** Applied once per ledger key: the paid period, or the end. */
  grant: GrantResult;
}

/**
 * Sync one subscription to the state Bachs reports NOW (spec §5, §6).
 *
 * The webhook does not trust an event's copy of the subscription: it fetches the current one
 * and calls this, and the hourly reconciliation calls the same thing. Delivery order then
 * cannot matter, and a missed webhook is caught by the next run with the same keys.
 *
 * KEYS. A paid period is `period:{sub}:{start}:{product}` — the product is in the key because
 * an upgrade with proration is a new grant inside the same period. The end is `end:{sub}`.
 */
export const syncSubscription = (
  account: Account,
  snap: import('./events').SubscriptionSnapshot,
  tier: import('./catalog').PaidTier | null,
  cfg: PricingLike,
  chargedMinor: number | null,
): SyncResult => {
  const { purchased } = balances(account);
  const ids = { bachs_subscription_id: snap.id, bachs_customer_id: snap.customerId, billing_currency: 'USD' };

  if (snap.status === 'canceled' || snap.status === 'unpaid') {
    return {
      stateUpdate: {},
      grant: {
        ...NONE,
        ledgerKey: `end:${snap.id}`,
        userUpdate: {
          tier: 'free', billing_mode: null, subscription_status: 'free', bachs_subscription_id: null,
          ...balanceFields(0, purchased),
        },
      },
    };
  }
  if (snap.status === 'past_due') return { stateUpdate: { ...ids, subscription_status: 'past_due' }, grant: NONE };
  if (snap.status !== 'active') return { stateUpdate: ids, grant: NONE };

  const ledgerKey = `period:${snap.id}:${snap.currentPeriodStart}:${snap.productId}`;
  const stateUpdate = {
    ...ids,
    subscription_status: snap.cancelAtPeriodEnd ? 'cancelled' : 'active',
    plan_renews_at: snap.currentPeriodEnd,
  };
  if (!tier) return { stateUpdate: {}, grant: { ...NONE, ledgerKey, review: `subscription on unknown product ${snap.productId}` } };
  const item = catalogItem(cfg, 'plan', tier, 'USD');
  if (!item || snap.currency !== 'USD' || snap.amountMinor !== item.amountMinor) {
    return { stateUpdate: {}, grant: { ...NONE, ledgerKey, review: `subscription bills ${snap.amountMinor} ${snap.currency}, ${tier} is ${item?.amountMinor} USD` } };
  }
  return {
    stateUpdate,
    grant: {
      ledgerKey,
      review: null,
      checkoutStatus: null,
      userUpdate: { tier, billing_mode: 'subscription', ...balanceFields(item.tokens, purchased) },
      payment: { kind: 'plan', item: tier, amount_minor: chargedMinor ?? item.amountMinor, currency: 'USD', tokens_credited: item.tokens },
    },
  };
};
```

- [ ] **Step 4: Run the test to see it pass** — all `PASS`.

- [ ] **Step 5: Negative control** — temporarily drop `:${snap.productId}` from `ledgerKey`; confirm the upgrade check FAILS; revert.

- [ ] **Step 6: Commit**

```bash
(cd functions && npx tsc --noEmit -p .)
git add functions/src/bachs/grant.ts scripts/bachs.test.ts
git commit -m "Bachs grants: sync a USD subscription to its current state, once per period"
```

---

### Task 7: The Bachs API wrapper

**Files:**
- Create: `functions/src/bachs/api.ts`
- Modify: `scripts/bachs.test.ts`

**Interfaces:**
- Produces: `bachsBaseUrl(key: string): string`; `bachsApi(key: string, fetchImpl?: typeof fetch): BachsApi` where

```ts
interface BachsApi {
  createCheckoutSession(body: Record<string, unknown>, idempotencyKey: string): Promise<{ checkout_id: string; checkout_url: string }>;
  getCheckoutSession(id: string): Promise<unknown>;
  getSubscription(id: string): Promise<unknown>;
  changeSubscriptionProduct(id: string, productId: string, idempotencyKey: string): Promise<unknown>;
  cancelSubscriptionAtPeriodEnd(id: string, idempotencyKey: string): Promise<unknown>;
  createPortalSession(customerId: string, idempotencyKey: string): Promise<{ url: string }>;
  listProducts(): Promise<unknown[]>;
  createProduct(body: Record<string, unknown>, idempotencyKey: string): Promise<{ id: string }>;
}
```
- `class BachsApiError extends Error { status: number; code: string | null }`

- [ ] **Step 1: Write the failing test** — add `import { bachsApi, bachsBaseUrl, BachsApiError } from '../functions/src/bachs/api';` and insert (top-level `await` is fine under tsx/ESM):

```ts
console.log('\nAPI WRAPPER:');
ok(bachsBaseUrl('sk_live_x') === 'https://api.bachs.io/v1' && bachsBaseUrl('sk_sandbox_x') === 'https://sandbox-api.bachs.io/v1',
  'the key decides the environment (a sandbox key can never reach live)');
const calls: Array<{ url: string; init: any }> = [];
const fakeFetch = (async (url: string, init: any) => {
  calls.push({ url, init });
  if (url.endsWith('/v1/checkout-sessions')) return new Response(JSON.stringify({ checkout_id: 'chk_1', checkout_url: 'https://checkout.bachs.io/c/1' }), { status: 200 });
  if (url.includes('/subscriptions/sub_404')) return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'no' } }), { status: 404 });
  return new Response(JSON.stringify({ data: { id: 'sub_1', status: 'active' } }), { status: 200 });
}) as unknown as typeof fetch;
const api = bachsApi('sk_sandbox_k', fakeFetch);
const session = await api.createCheckoutSession({ reference: 'mb_1' }, 'mb_1');
ok(session.checkout_url === 'https://checkout.bachs.io/c/1', 'a checkout session returns its URL');
ok(calls[0].init.headers.Authorization === 'Bearer sk_sandbox_k' && calls[0].init.headers['Idempotency-Key'] === 'mb_1'
  && calls[0].init.method === 'POST', 'POSTs carry the bearer key and an idempotency key');
ok(((await api.getSubscription('sub_1')) as any).data.id === 'sub_1', 'a GET returns the parsed body');
let apiErr: any = null; try { await api.getSubscription('sub_404'); } catch (e) { apiErr = e; }
ok(apiErr instanceof BachsApiError && apiErr.status === 404 && apiErr.code === 'NOT_FOUND', 'an error response throws BachsApiError with status and code');
await api.cancelSubscriptionAtPeriodEnd('sub_1', 'cancel_sub_1');
const cancelCall = calls[calls.length - 1];
ok(cancelCall.init.method === 'DELETE' && JSON.parse(cancelCall.init.body).cancel_at_period_end === true,
  'cancel always sends cancel_at_period_end: true (an API cancel is otherwise immediate)');
```

- [ ] **Step 2: Run it to see it fail** — expected: `Cannot find module '../functions/src/bachs/api'`.

- [ ] **Step 3: Implement `functions/src/bachs/api.ts`**

```ts
/**
 * Thin Bachs REST v1 client (spec §3). Plain fetch rather than @bachs/sdk: the SDK was published
 * the day before the design and has no subscription PATCH or refunds. Every write carries an
 * Idempotency-Key, so a retried call cannot create a second checkout or a second cancel.
 *
 * THE KEY DECIDES THE ENVIRONMENT. sk_live_ talks to production, anything else to the sandbox —
 * there is no separate setting that could point a sandbox key at live, or the reverse.
 */
export class BachsApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null) {
    super(message);
    this.name = 'BachsApiError';
  }
}

export const bachsBaseUrl = (key: string): string =>
  key.startsWith('sk_live_') ? 'https://api.bachs.io/v1' : 'https://sandbox-api.bachs.io/v1';

export interface BachsApi {
  createCheckoutSession(body: Record<string, unknown>, idempotencyKey: string): Promise<{ checkout_id: string; checkout_url: string }>;
  getCheckoutSession(id: string): Promise<unknown>;
  getSubscription(id: string): Promise<unknown>;
  changeSubscriptionProduct(id: string, productId: string, idempotencyKey: string): Promise<unknown>;
  cancelSubscriptionAtPeriodEnd(id: string, idempotencyKey: string): Promise<unknown>;
  createPortalSession(customerId: string, idempotencyKey: string): Promise<{ url: string }>;
  listProducts(): Promise<unknown[]>;
  createProduct(body: Record<string, unknown>, idempotencyKey: string): Promise<{ id: string }>;
}

export const bachsApi = (key: string, fetchImpl: typeof fetch = fetch): BachsApi => {
  if (!key) throw new BachsApiError('BACHS_SECRET_KEY is not set', 0, 'NO_KEY');
  const base = bachsBaseUrl(key);

  const call = async (method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<any> => {
    const headers: Record<string, string> = { Authorization: `Bearer ${key}`, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const res = await fetchImpl(`${base}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    } as RequestInit);
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!res.ok) {
      const err = json?.error ?? json ?? {};
      throw new BachsApiError(String(err.message || `Bachs ${method} ${path} → ${res.status}`), res.status, err.code ? String(err.code) : null);
    }
    return json;
  };

  return {
    createCheckoutSession: (body, idem) => call('POST', '/checkout-sessions', body, idem).then((j) => j?.data ?? j),
    getCheckoutSession: (id) => call('GET', `/checkout-sessions/${encodeURIComponent(id)}`),
    getSubscription: (id) => call('GET', `/subscriptions/${encodeURIComponent(id)}`),
    changeSubscriptionProduct: (id, productId, idem) =>
      call('PATCH', `/subscriptions/${encodeURIComponent(id)}`, { product_id: productId, proration_behavior: 'invoice_now' }, idem),
    cancelSubscriptionAtPeriodEnd: (id, idem) =>
      call('DELETE', `/subscriptions/${encodeURIComponent(id)}`, { cancel_at_period_end: true, reason: 'customer_request' }, idem),
    createPortalSession: (customerId, idem) =>
      call('POST', `/customers/${encodeURIComponent(customerId)}/portal-sessions`, undefined, idem).then((j) => j?.data ?? j),
    listProducts: () => call('GET', '/products').then((j) => (Array.isArray(j?.items) ? j.items : Array.isArray(j?.data) ? j.data : [])),
    createProduct: (body, idem) => call('POST', '/products', body, idem).then((j) => j?.data ?? j),
  };
};
```

- [ ] **Step 4: Run the test to see it pass** — all `PASS`. Then `node scripts/deploy.test.mjs` → `PASS` (the module uses only globals).

- [ ] **Step 5: Commit**

```bash
(cd functions && npx tsc --noEmit -p .)
git add functions/src/bachs/api.ts scripts/bachs.test.ts
git commit -m "Bachs API wrapper: key picks the environment, idempotent writes, typed errors"
```

---

### Task 8: Create the USD products in the sandbox

**Files:**
- Create: `scripts/bachs/setup.ts`
- Modify: `functions/.env` (append three product-id lines; not committed)

**Interfaces:**
- Consumes: `bachsApi` (Task 7), `catalogItem`, `PAID_TIERS`, `toMajorString` (Task 2).
- Produces: env vars `BACHS_PRODUCT_PRO`, `BACHS_PRODUCT_TEAM`, `BACHS_PRODUCT_AGENCY` in `functions/.env`.

- [ ] **Step 1: Write the script** — `scripts/bachs/setup.ts`:

```ts
/**
 * Creates the three USD monthly products in a Bachs environment, idempotently (spec §3).
 *
 *   npx tsx scripts/bachs/setup.ts            # uses BACHS_SECRET_KEY from functions/.secret.local
 *   npx tsx scripts/bachs/setup.ts --write    # also writes BACHS_PRODUCT_* into functions/.env
 *
 * A product is matched by `metadata.mb_key` (e.g. "plan_pro_usd_monthly"), so re-running finds
 * the existing one instead of creating a duplicate. Prices come from the pricing config — the
 * same numbers the catalog charges — never typed here.
 *
 * NOT IN THE BUILD: it talks to Bachs. Never run it with a live key until rollout step 4.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PRICING_CONFIG as CFG } from '../../config/pricingConfig';
import { PAID_TIERS, catalogItem, toMajorString } from '../../functions/src/bachs/catalog';
import { bachsApi } from '../../functions/src/bachs/api';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readKey = (file: string, name: string): string => {
  const p = path.join(root, 'functions', file);
  if (!fs.existsSync(p)) return '';
  const line = fs.readFileSync(p, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return (line?.slice(name.length + 1) ?? '').trim().replace(/^["']|["']$/g, '');
};

const key = process.env.BACHS_SECRET_KEY || readKey('.secret.local', 'BACHS_SECRET_KEY');
if (!key) { console.error('No BACHS_SECRET_KEY in the environment or functions/.secret.local'); process.exit(1); }
console.log(`Environment: ${key.startsWith('sk_live_') ? 'LIVE' : 'sandbox'}`);

const api = bachsApi(key);
const existing = (await api.listProducts()) as Array<Record<string, any>>;
const ids: Record<string, string> = {};

for (const tier of PAID_TIERS) {
  const item = catalogItem(CFG, 'plan', tier, 'USD');
  if (!item) throw new Error(`no USD price for ${tier}`);
  const mbKey = `plan_${tier}_usd_monthly`;
  const found = existing.find((p) => p?.metadata?.mb_key === mbKey);
  if (found) {
    ids[tier] = String(found.id);
    console.log(`${tier}: exists ${found.id}`);
    continue;
  }
  const created = await api.createProduct({
    name: `MarketBrain OS ${tier.charAt(0).toUpperCase()}${tier.slice(1)}`,
    description: `${item.tokens} tokens a month`,
    price: { currency: 'USD', amount: toMajorString(item.amountMinor), price_type: 'fixed' },
    billing_cycle: { interval: 'month', frequency: 1 },
    metadata: { mb_key: mbKey },
  }, `setup_${mbKey}`);
  ids[tier] = String(created.id);
  console.log(`${tier}: created ${created.id}`);
}

const lines = PAID_TIERS.map((t) => `BACHS_PRODUCT_${t.toUpperCase()}=${ids[t]}`);
console.log('\n' + lines.join('\n'));
if (process.argv.includes('--write')) {
  const envPath = path.join(root, 'functions', '.env');
  const kept = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('BACHS_PRODUCT_'));
  fs.writeFileSync(envPath, [...kept, ...lines].join('\n') + '\n');
  console.log('written to functions/.env');
}
```

- [ ] **Step 2: Confirm `deploy.test.mjs` does not walk it** — it is not in the build command. Run `node scripts/deploy.test.mjs`; expected `PASS`.

- [ ] **Step 3: Run it against the sandbox**

Run: `npx tsx scripts/bachs/setup.ts --write`
Expected: `Environment: sandbox`, three `created prod_…` lines, `written to functions/.env`.
If Bachs answers `SUBSCRIPTIONS_NOT_ENABLED`, stop: subscriptions must be enabled on the account by Bachs support (spec §8 step 3) before Tasks 10–14 can complete the USD path; the naira and pack paths do not depend on it.

- [ ] **Step 4: Run it again to prove it is idempotent** — expected three `exists prod_…` lines with the same ids.

- [ ] **Step 5: Commit the script only**

```bash
git add scripts/bachs/setup.ts
git commit -m "Bachs setup script: create the three USD monthly products idempotently"
```

---

### Task 9: Currency-aware receipts and the three new emails

**Files:**
- Modify: `functions/src/email/templates.ts` (`money` at line 10; `tokenReceipt`, `paymentReceipt`, `paymentFailed`; new templates; `EMAIL_TEMPLATES` export at ~line 916)

**Interfaces:**
- Produces: `money(n: number, currency?: string)`; template keys `passReminder` `{ planName, expiresAt, daysLeft, amount, currency }`, `passExpired` `{ planName }`, `billingAlert` `{ title, lines: string[] }`. Existing receipts accept an optional `currency`.

- [ ] **Step 1: Make `money` currency-aware** — replace line 10:

```ts
/* Amounts are MAJOR units here (19, 9900). Naira is shown whole, as Nigerians read prices. */
const money = (n: number, currency = 'USD') =>
  String(currency).toUpperCase() === 'NGN'
    ? `₦${Math.round(Number(n) || 0).toLocaleString('en-US')}`
    : `$${(Number(n) || 0).toFixed(2)}`;
```

- [ ] **Step 2: Thread `currency` through the receipts** — in `tokenReceipt`, `paymentReceipt` and `paymentFailed` add `currency?: string` to the data type and change every `money(d.amount)` in them to `money(d.amount, d.currency)`.

- [ ] **Step 3: Add the three templates** above the `EMAIL_TEMPLATES` export, using the file's existing helpers:

```ts
const passReminder = (d: { planName: string; expiresAt: string; daysLeft: number; amount: number; currency: string }): RenderedEmail => ({
  subject: `Your ${d.planName} pass ends in ${d.daysLeft} day${d.daysLeft === 1 ? '' : 's'}`,
  html: renderEmail({
    preheader: `${d.planName} ends on ${d.expiresAt}. Renew for ${money(d.amount, d.currency)} to keep going.`,
    tag: 'Billing',
    heading: `Your ${span(d.planName)} pass ends soon.`,
    heroSubtext: `It ends on ${d.expiresAt}. Your pass does not renew by itself — renewing now adds 30 days to the end, so you lose nothing by doing it early.`,
    body: metaTable([
      { k: 'Plan', v: d.planName },
      { k: 'Ends', v: d.expiresAt },
      { k: 'Renewal', v: money(d.amount, d.currency), total: true },
    ]) + button('Renew my pass →', `${SITE_URL}/billing`),
    footerLinks: [{ label: 'Billing', href: `${SITE_URL}/billing` }, { label: 'Support', href: `${SITE_URL}/support` }],
    footerNote: 'You received this because your plan is about to end.',
  }),
});

const passExpired = (d: { planName: string }): RenderedEmail => ({
  subject: `Your ${d.planName} pass has ended`,
  html: renderEmail({
    preheader: `Your account is on Free now. Purchased tokens are kept.`,
    tag: 'Billing',
    heading: `Your ${span(d.planName)} pass has ended.`,
    heroSubtext: 'Your account is on the Free plan now. Tokens you bought are still yours, and buying a new pass restores everything straight away.',
    body: button('Buy a new pass →', `${SITE_URL}/billing`),
    footerLinks: [{ label: 'Billing', href: `${SITE_URL}/billing` }, { label: 'Support', href: `${SITE_URL}/support` }],
    footerNote: 'You received this because your plan ended.',
  }),
});

/* To the founder, not a customer: a payment that was taken but not granted, or webhooks missed. */
const billingAlert = (d: { title: string; lines: string[] }): RenderedEmail => ({
  subject: `[Billing] ${d.title}`,
  html: renderEmail({
    preheader: d.title,
    tag: 'Billing alert',
    heading: d.title,
    heroSubtext: 'Nothing was granted automatically for the items below. Check them in Firestore (billing_reviews) and the Bachs dashboard.',
    body: metaTable(d.lines.map((line, i) => ({ k: String(i + 1), v: line }))),
    footerLinks: [],
    footerNote: 'Sent by the MarketBrain OS billing checks.',
  }),
});
```

and add `passReminder, passExpired, billingAlert,` to the `EMAIL_TEMPLATES` object literal.

- [ ] **Step 4: Confirm the helpers exist and nothing else broke**

Run: `grep -n "const span\|const metaTable\|const button\|const renderEmail" functions/src/email/*.ts` — expected all four found (they are already used by `tokenReceipt` and `renewalReminder`). Then `(cd functions && npx tsc --noEmit -p .) && npx tsx scripts/lifecycle.test.ts`
Expected: no tsc output; lifecycle `PASS — …`. These three keys are transactional, so they must **not** be added to `MARKETING_KEYS`.

- [ ] **Step 5: Commit**

```bash
git add functions/src/email/templates.ts
git commit -m "Emails: naira-aware receipts, pass reminder and expiry, founder billing alert"
```

---

### Task 10: `createCheckout`, `manageBilling`, the shared sync, and Firestore rules

**Files:**
- Modify: `functions/src/index.ts` (imports; new block after `billingStatus`)
- Modify: `firestore.rules` (after the `payments` match, ~line 216)
- Modify: `scripts/grants.test.ts` (`ALLOWED_TIER_WRITERS`)

**Interfaces:**
- Consumes: everything from Tasks 2–7; `getPricingConfig`, `db`, `sendTemplate`, `assertAdmin`-style role read from index.ts.
- Produces (callables, used by Task 13's client):
  - `createCheckout({ kind: 'plan'|'pass'|'pack', item: string, currency: 'USD'|'NGN' }) → { url: string }`
  - `manageBilling({ action: 'cancel'|'upgrade'|'portal', item?: string }) → { ok: true } | { url: string }`
- Produces (index.ts internal, used by Tasks 11–12): `applyOneOffPayment(event, source)`, `syncSubscriptionById(id, chargedMinor, source)`, `billingAlertEmail(title, lines)`, `BACHS_SECRETS`.

- [ ] **Step 1: Extend the grant guard first (fails until Step 4)** — in `scripts/grants.test.ts` add to the allowlist and a check that the helpers stay unexported:

```ts
  createCheckout: 'writes a checkout record and the requested item; grants nothing',
  manageBilling: 'calls Bachs, then the shared subscription sync (verified state only)',
```

```ts
ok(/\nconst applyOneOffPayment = async/.test(index) && /\nconst syncSubscriptionById = async/.test(index),
  'the two grant helpers exist and are not exported (no callable can invoke them directly)');
```

Run: `npx tsx scripts/grants.test.ts` — expected FAIL on the new helper check.

- [ ] **Step 2: Add imports at the top of `functions/src/index.ts`** (after the existing local imports):

```ts
import { catalogItem, toMajorString, TIER_RANK, PaidTier, Kind, Currency } from './bachs/catalog';
import { billingLive as bachsBillingLive, productForTier, tierForProduct } from './bachs/config';
import { BachsEvent, parseSubscription } from './bachs/events';
import { Account, CheckoutRecord, applyOneOff, checkoutAllowed, syncSubscription } from './bachs/grant';
import { bachsApi } from './bachs/api';
```

- [ ] **Step 3: Add the block** after the `billingStatus` export:

```ts
/* ============================================================
   BACHS PAYMENTS (spec docs/superpowers/specs/2026-10-18-bachs-payments-design.md)
   ============================================================ */

const BACHS_SECRETS = ['BACHS_SECRET_KEY', 'BACHS_WEBHOOK_SECRET'];
const SITE = 'https://www.marketbrainos.app';
const bachs = () => bachsApi(process.env.BACHS_SECRET_KEY || '');
const ledgerDoc = (key: string) =>
  db.collection('payment_events').doc(crypto.createHash('sha256').update(key).digest('hex').slice(0, 40));
type GrantSource = 'webhook' | 'reconcile' | 'manage';

const billingAlertEmail = async (title: string, lines: string[]) =>
  sendTemplate(process.env.BILLING_ALERT_EMAIL || 'support@marketbrainos.app', 'billingAlert' as any, { title, lines });

/**
 * A one-off payment (pass or pack), applied exactly once with its ledger entry in ONE
 * transaction: if anything fails both roll back and Bachs' retry re-applies cleanly. The
 * checkout record — written by us — says who and what; the event only says money moved.
 */
const applyOneOffPayment = async (
  event: Pick<BachsEvent, 'id' | 'reference' | 'amountMinor' | 'currency' | 'checkoutId'>,
  source: GrantSource,
): Promise<'ignored' | 'already handled' | 'granted' | 'review'> => {
  if (!event.reference) return 'ignored';
  const cfg = await getPricingConfig();
  const nowIso = new Date().toISOString();
  const checkoutRef = db.collection('checkouts').doc(event.reference);
  const key = `checkout:${event.reference}`;
  let notify: { uid: string; kind: string; item: string; currency: string; amount_minor: number; tokens: number } | null = null;
  let reviewWhy: string | null = null;

  const outcome = await db.runTransaction(async (t: admin.firestore.Transaction) => {
    const ledgerRef = ledgerDoc(key);
    if ((await t.get(ledgerRef)).exists) return 'already handled' as const;
    const checkoutSnap = await t.get(checkoutRef);
    const checkout = checkoutSnap.exists ? (checkoutSnap.data() as CheckoutRecord) : null;
    const userRef = checkout ? db.collection('users').doc(checkout.uid) : null;
    const userSnap = userRef ? await t.get(userRef) : null;
    const account = userSnap && userSnap.exists ? (userSnap.data() as Account) : null;

    const r = applyOneOff(account, checkout, event, cfg, nowIso);
    if (!r.ledgerKey) return 'ignored' as const;
    if (r.userUpdate && userRef && account) t.update(userRef, r.userUpdate);
    if (r.payment && checkout) {
      t.set(db.collection('payments').doc(), {
        uid: checkout.uid, provider: 'bachs', ...r.payment, bachs_reference: event.reference,
        bachs_checkout_id: event.checkoutId ?? null, source, status: 'success',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      notify = { uid: checkout.uid, kind: r.payment.kind, item: r.payment.item, currency: r.payment.currency, amount_minor: r.payment.amount_minor, tokens: r.payment.tokens_credited };
    }
    if (r.checkoutStatus && checkoutSnap.exists) t.update(checkoutRef, { status: r.checkoutStatus, settled_at: nowIso });
    if (r.review) {
      reviewWhy = r.review;
      t.set(db.collection('billing_reviews').doc(), {
        reason: r.review, key, event_id: event.id, uid: checkout?.uid ?? null,
        amount_minor: event.amountMinor, currency: event.currency, source,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    t.set(ledgerRef, { key, source, event_id: event.id, outcome: r.review ? 'review' : 'granted', created_at: admin.firestore.FieldValue.serverTimestamp() });
    return r.review ? ('review' as const) : ('granted' as const);
  });

  if (outcome === 'granted' && notify) {
    const n = notify as { uid: string; kind: string; item: string; currency: string; amount_minor: number; tokens: number };
    const user = (await db.collection('users').doc(n.uid).get()).data() || {};
    if (user.email) {
      const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      if (n.kind === 'pack') {
        await sendTemplate(user.email, 'tokenReceipt', {
          packLabel: n.item, tokens: n.tokens, amount: n.amount_minor / 100, currency: n.currency,
          newBalance: readBalances(user).monthly + readBalances(user).purchased, reference: event.reference, date,
        });
      } else {
        await sendTemplate(user.email, 'paymentReceipt', {
          description: `${n.item} plan, 30 days`, amount: n.amount_minor / 100, currency: n.currency, reference: event.reference, date,
        });
      }
    }
  }
  if (outcome === 'review') await billingAlertEmail('A payment needs review', [`${key}: ${reviewWhy}`]);
  return outcome;
};

/**
 * Sync one subscription to Bachs' CURRENT state (spec §5–6). Called by the webhook for every
 * subscription event, by manageBilling after a change, and hourly by reconciliation — the same
 * keys everywhere, so whichever path sees a paid period first grants it and the rest no-op.
 */
const syncSubscriptionById = async (subscriptionId: string, chargedMinor: number | null, source: GrantSource): Promise<string> => {
  const snap = parseSubscription(await bachs().getSubscription(subscriptionId));
  if (!snap) throw new Error(`unreadable subscription ${subscriptionId}`);
  let uid = snap.metadata.uid || null;
  if (!uid) {
    const q = await db.collection('users').where('bachs_subscription_id', '==', subscriptionId).limit(1).get();
    uid = q.empty ? null : q.docs[0]!.id;
  }
  if (!uid) {
    await db.collection('billing_reviews').add({ reason: 'subscription with no account', key: `sub:${subscriptionId}`, source, created_at: admin.firestore.FieldValue.serverTimestamp() });
    await billingAlertEmail('A subscription has no account', [subscriptionId]);
    return 'review';
  }
  const cfg = await getPricingConfig();
  const tier: PaidTier | null = tierForProduct(snap.productId, process.env);
  const userRef = db.collection('users').doc(uid);
  let reviewWhy: string | null = null;

  const outcome = await db.runTransaction(async (t: admin.firestore.Transaction) => {
    const userSnap = await t.get(userRef);
    if (!userSnap.exists) return 'no account';
    const account = userSnap.data() as Account;
    const r = syncSubscription(account, snap, tier, cfg, chargedMinor);
    const ledgerRef = r.grant.ledgerKey ? ledgerDoc(r.grant.ledgerKey) : null;
    const seen = ledgerRef ? (await t.get(ledgerRef)).exists : true;
    if (Object.keys(r.stateUpdate).length) t.update(userRef, r.stateUpdate);
    if (!ledgerRef || seen) return 'state synced';
    if (r.grant.userUpdate) t.update(userRef, r.grant.userUpdate);
    if (r.grant.payment) {
      t.set(db.collection('payments').doc(), {
        uid, provider: 'bachs', ...r.grant.payment, bachs_subscription_id: snap.id, source, status: 'success',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    if (r.grant.review) {
      reviewWhy = r.grant.review;
      t.set(db.collection('billing_reviews').doc(), { reason: r.grant.review, key: r.grant.ledgerKey, uid, source, created_at: admin.firestore.FieldValue.serverTimestamp() });
    }
    t.set(ledgerRef, { key: r.grant.ledgerKey, source, outcome: r.grant.review ? 'review' : 'granted', created_at: admin.firestore.FieldValue.serverTimestamp() });
    return r.grant.review ? 'review' : 'granted';
  });
  if (outcome === 'review') await billingAlertEmail('A subscription needs review', [`${subscriptionId}: ${reviewWhy}`]);
  return outcome;
};

/** Starts a Bachs hosted checkout for one item (spec §3). Grants nothing. */
export const createCheckout = functions.runWith({ secrets: BACHS_SECRETS }).https.onCall(async (data: any, context: any) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const uid = context.auth.uid;
  const email = String(context.auth.token.email || '');
  const kind = data?.kind as Kind;
  const item = String(data?.item || '');
  const currency = data?.currency as Currency;
  if (!['plan', 'pass', 'pack'].includes(kind) || !['USD', 'NGN'].includes(currency)) {
    throw new functions.https.HttpsError('invalid-argument', 'Choose something to buy and a currency.');
  }
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'User profile not found.');
  const account = userSnap.data() as Account & { role?: string; is_suspended?: boolean; name?: string; displayName?: string };
  /* The server half of "super-admins can test before launch": everyone else is refused here,
     whatever the client shows. */
  if (!bachsBillingLive(process.env) && account.role !== 'super_admin') {
    throw new functions.https.HttpsError('failed-precondition', 'Payments are not live yet.');
  }
  if (account.is_suspended) throw new functions.https.HttpsError('permission-denied', 'Account suspended.');
  const nowIso = new Date().toISOString();
  const allowed = checkoutAllowed(account, kind, item, nowIso);
  if (!allowed.ok) throw new functions.https.HttpsError('failed-precondition', allowed.reason);
  const ci = catalogItem(await getPricingConfig(), kind, item, currency);
  if (!ci) throw new functions.https.HttpsError('invalid-argument', 'That is not for sale in that currency.');
  const productId = kind === 'plan' ? productForTier(ci.tier as PaidTier, process.env) : null;
  if (kind === 'plan' && !productId) throw new functions.https.HttpsError('failed-precondition', 'Plans are not set up yet.');

  const reference = `mb_${crypto.randomBytes(12).toString('hex')}`;
  const checkoutRef = db.collection('checkouts').doc(reference);
  await checkoutRef.set({ uid, kind, item, currency, amount_minor: ci.amountMinor, status: 'open', created_at: nowIso });
  const name = account.name || account.displayName || email;
  const common = {
    reference,
    metadata: { uid, kind, item, currency },
    success_url: `${SITE}/billing?checkout=success`,
    cancel_url: `${SITE}/billing?checkout=cancelled`,
    expires_in_minutes: 60,
    ...(email ? { customer: { email, name } } : {}),
  };
  const body = kind === 'plan'
    ? { ...common, product_cart: [{ product_id: productId, quantity: 1 }] }
    : { ...common, pricing: { currency, amount: toMajorString(ci.amountMinor) } };
  const session = await bachs().createCheckoutSession(body, reference);
  await checkoutRef.update({ bachs_checkout_id: session.checkout_id });
  return { url: session.checkout_url };
});

/** Cancel at period end, upgrade, or open the card portal — USD subscriptions only (spec §3). */
export const manageBilling = functions.runWith({ secrets: BACHS_SECRETS }).https.onCall(async (data: any, context: any) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  const uid = context.auth.uid;
  const action = data?.action as 'cancel' | 'upgrade' | 'portal';
  if (!['cancel', 'upgrade', 'portal'].includes(action)) throw new functions.https.HttpsError('invalid-argument', 'Unknown billing action.');
  const account = (await db.collection('users').doc(uid).get()).data() as Account | undefined;
  if (!account) throw new functions.https.HttpsError('not-found', 'User profile not found.');

  if (action === 'portal') {
    if (!account.bachs_customer_id) throw new functions.https.HttpsError('failed-precondition', 'There is no card on file.');
    const s = await bachs().createPortalSession(account.bachs_customer_id, `portal_${uid}_${Date.now()}`);
    return { url: s.url };
  }
  const subId = account.bachs_subscription_id;
  if (account.billing_mode !== 'subscription' || !subId) {
    throw new functions.https.HttpsError('failed-precondition', 'There is no dollar subscription to change.');
  }
  if (action === 'cancel') {
    await bachs().cancelSubscriptionAtPeriodEnd(subId, `cancel_${subId}`);
    await syncSubscriptionById(subId, null, 'manage');
    return { ok: true };
  }
  const target = String(data?.item || '') as PaidTier;
  if ((TIER_RANK[target] ?? 0) <= (TIER_RANK[account.tier || 'free'] ?? 0)) {
    throw new functions.https.HttpsError('failed-precondition', 'Choose a higher plan to upgrade to.');
  }
  const productId = productForTier(target, process.env);
  if (!productId) throw new functions.https.HttpsError('failed-precondition', 'That plan is not set up yet.');
  await bachs().changeSubscriptionProduct(subId, productId, `upgrade_${subId}_${target}`);
  /* The new tier is granted when Bachs reports the prorated invoice paid (webhook or the hourly sync). */
  return { ok: true };
});
```

- [ ] **Step 4: Firestore rules** — after the `match /payments/{id} { … }` block add:

```
    // Bachs billing (server-only; Admin SDK writes). The client never reads or writes these.
    match /checkouts/{id}       { allow read, write: if false; }
    match /payment_events/{id}  { allow read, write: if false; }
    match /billing_reviews/{id} { allow read: if isPlatformAdmin(); allow write: if false; }
```

- [ ] **Step 5: Verify**

Run: `(cd functions && npx tsc --noEmit -p .) && npx tsx scripts/grants.test.ts && node scripts/deploy.test.mjs`
Expected: no tsc output; grants `PASS — …`; deploy `PASS — …`.

- [ ] **Step 6: Commit**

```bash
git add functions/src/index.ts firestore.rules scripts/grants.test.ts
git commit -m "Bachs: createCheckout and manageBilling callables, one-transaction grant helpers, rules"
```

---

### Task 11: The webhook, the live switch, and retiring Paystack

**Files:**
- Modify: `functions/src/index.ts` (replace the whole `PAYSTACK WEBHOOK` section and `billingStatus`; remove the `./paystack` import)
- Delete: `functions/src/paystack.ts`, `scripts/paystack.test.ts`
- Modify: `package.json` (remove `tsx scripts/paystack.test.ts && ` from `build` and the `test:paystack` script)
- Modify: `scripts/grants.test.ts` (allowlist: replace `paystackWebhook` with `bachsWebhook`)
- Modify: `scripts/bachs.test.ts` (carry over the "switch reaches the buttons" checks)

**Interfaces:**
- Consumes: `verifyBachsSignature`, `BACHS_SIGNATURE_HEADER` (Task 3), `parseBachsEvent` (Task 4), `applyOneOffPayment`, `syncSubscriptionById`, `billingAlertEmail` (Task 10).
- Produces: HTTP endpoint `bachsWebhook` at `https://us-central1-marketbrainosweb.cloudfunctions.net/bachsWebhook`; `billingStatus` → `{ billing_live, provider: 'bachs' }`.

- [ ] **Step 1: Carry the client-switch checks into `scripts/bachs.test.ts`** (they lived in the Paystack test) — add `import fs from 'node:fs'; import path from 'node:path';` and insert:

```ts
console.log('\nTHE SWITCH REACHES THE BUTTONS:');
const src = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const idx = src('functions/src/index.ts');
ok(/export const bachsWebhook = /.test(idx) && !/export const paystackWebhook = /.test(idx), 'bachsWebhook is the payment webhook; Paystack is gone');
ok(/provider: 'bachs'/.test(idx), 'billingStatus reports provider bachs');
ok(/billingStatus = functions\.runWith\(\{ secrets: BACHS_SECRETS \}\)/.test(idx),
  'billingStatus is bound to the secret (otherwise it can never see the key and always says "not live")');
ok(/rawBody/.test(idx.slice(idx.indexOf('export const bachsWebhook'))), 'the webhook verifies the raw body');
ok(/fetchBillingStatus\(\)/.test(src('pages/Pricing.tsx')) && /fetchBillingStatus\(\)/.test(src('components/SubscriptionPanel.tsx')),
  'the pricing page and the plan panel read billing status');
```

Run `npx tsx scripts/bachs.test.ts` — expected FAIL on the first three checks.

- [ ] **Step 2: Replace the Paystack section and `billingStatus`** in `functions/src/index.ts` with:

```ts
/* ============================================================
   BACHS WEBHOOK (spec §6) — the only place a payment becomes paid value
   ============================================================ */

/**
 * SIGNATURE over the RAW bytes, or nothing happens. Then each event goes to the one function that
 * owns it, and each of those applies its grant with its ledger entry in one transaction. Status
 * codes: 500 only when something transient failed (Bachs retries); everything else 200, so an
 * event we will never act on is not re-sent forever.
 */
export const bachsWebhook = functions.runWith({ secrets: BACHS_SECRETS }).https.onRequest(async (req: any, res: any) => {
  if (req.method !== 'POST') { res.status(405).send('Use POST.'); return; }
  const raw: Buffer | undefined = (req as any).rawBody;
  if (!raw) { console.error('bachsWebhook: no rawBody'); res.status(400).send('Cannot verify.'); return; }
  if (!verifyBachsSignature(raw, req.headers[BACHS_SIGNATURE_HEADER], process.env.BACHS_WEBHOOK_SECRET)) {
    res.status(401).send('Unauthorized');
    return;
  }
  const event = parseBachsEvent(req.body);
  if (!event) { res.status(200).send('Ignored'); return; }
  try {
    if (event.kind === 'one_off_paid') {
      res.status(200).send(await applyOneOffPayment(event, 'webhook'));
      return;
    }
    if (event.kind === 'subscription_linked') {
      const checkout = event.reference ? (await db.collection('checkouts').doc(event.reference).get()).data() : undefined;
      if (checkout?.uid && event.subscriptionId) {
        await db.collection('users').doc(checkout.uid).set(
          { bachs_subscription_id: event.subscriptionId, bachs_customer_id: event.customerId ?? null }, { merge: true });
        await db.collection('checkouts').doc(event.reference as string).update({ status: 'paid', settled_at: new Date().toISOString() });
        res.status(200).send(await syncSubscriptionById(event.subscriptionId, event.amountMinor, 'webhook'));
        return;
      }
      res.status(200).send('Ignored');
      return;
    }
    if (event.kind === 'subscription_changed' && event.subscriptionId) {
      const charged = event.type === 'invoice.paid' ? event.amountMinor : null;
      res.status(200).send(await syncSubscriptionById(event.subscriptionId, charged, 'webhook'));
      return;
    }
    if (event.kind === 'review') {
      const ref = ledgerDoc(`event:${event.id}`);
      const first = await db.runTransaction(async (t: admin.firestore.Transaction) => {
        if ((await t.get(ref)).exists) return false;
        t.set(ref, { key: `event:${event.id}`, source: 'webhook', outcome: 'review', created_at: admin.firestore.FieldValue.serverTimestamp() });
        t.set(db.collection('billing_reviews').doc(), { reason: event.type, event_id: event.id, reference: event.reference, created_at: admin.firestore.FieldValue.serverTimestamp() });
        return true;
      });
      if (first) await billingAlertEmail(`Bachs: ${event.type}`, [`event ${event.id}`, `reference ${event.reference ?? 'none'}`]);
      res.status(200).send('Recorded');
      return;
    }
    res.status(200).send('Ignored');
  } catch (error: any) {
    console.error('bachsWebhook failed:', error?.message || error);
    res.status(500).send('Retry');
  }
});

/** Whether the product shows a way to pay. Bound to the secret so it can see the key. */
export const billingStatus = functions.runWith({ secrets: BACHS_SECRETS }).https.onRequest((req: any, res: any) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.status(200).json({ billing_live: bachsBillingLive(process.env), provider: 'bachs' });
});
```

Also add `import { BACHS_SIGNATURE_HEADER, verifyBachsSignature } from './bachs/signature';` and `parseBachsEvent` to the events import, and delete the `from './paystack'` import. `bachsWebhook` and `billingStatus` must be defined **after** the Task 10 block (they use `BACHS_SECRETS` and the helpers), so move this section below it if needed.

- [ ] **Step 3: Delete Paystack** — `git rm functions/src/paystack.ts scripts/paystack.test.ts`; edit `package.json` as listed; in `scripts/grants.test.ts` replace the `paystackWebhook` allowlist line with `bachsWebhook: 'verified Bachs payment webhook (state synced from Bachs)',`.

- [ ] **Step 4: Verify**

Run: `(cd functions && npx tsc --noEmit -p .) && npx tsx scripts/bachs.test.ts && npx tsx scripts/grants.test.ts && node scripts/deploy.test.mjs && grep -rn "paystack" --include=*.ts --include=*.tsx --include=*.json functions/src services components pages scripts package.json`
Expected: tests `PASS`; the final grep prints nothing.

- [ ] **Step 5: Commit**

```bash
git add -A functions/src/index.ts functions/src/paystack.ts scripts/paystack.test.ts package.json scripts/grants.test.ts scripts/bachs.test.ts
git commit -m "Bachs webhook replaces Paystack; billingStatus reads the Bachs switch"
```

---

### Task 12: Scheduled jobs — reconciliation, pass lifecycle, daily check; refresh skips billed accounts

**Files:**
- Modify: `functions/src/index.ts` (append after the webhook; edit `monthlyTokenRefresh`'s `due` filter)
- Modify: `scripts/grants.test.ts` (allowlist `passLifecycle`, `bachsReconcile`)

**Interfaces:**
- Consumes: `parseCheckoutSession` (Task 4), `reminderDue`, `expirePass` (Task 5), `applyOneOffPayment`, `syncSubscriptionById`, `billingAlertEmail` (Task 10).

- [ ] **Step 1: Failing guard** — in `scripts/grants.test.ts` add:

```ts
const refresh = exported(index, 'monthlyTokenRefresh');
ok(/billing_mode === 'subscription' \|\| u\.billing_mode === 'pass'/.test(refresh),
  'monthlyTokenRefresh skips Bachs-billed accounts (their allowance resets only when money arrives)');
```

and allowlist lines:

```ts
  passLifecycle: 'expires ended passes to Free (writes tier free only)',
  bachsReconcile: 'hourly sync through the same grant helpers as the webhook',
```

Run `npx tsx scripts/grants.test.ts` — expected FAIL on the refresh check.

- [ ] **Step 2: Make the refresh skip billed accounts** — in `monthlyTokenRefresh`'s `due` filter, after `if (u.subscription_status === 'expired') return false;` add:

```ts
      /* Bachs-billed plans refresh when money arrives (invoice.paid / a pass), never on a date. */
      if (u.billing_mode === 'subscription' || u.billing_mode === 'pass') return false;
```

- [ ] **Step 3: Add the three jobs** after the webhook (add `parseCheckoutSession` to the events import and `expirePass, reminderDue` to the grant import):

```ts
/* Hourly: whatever the webhook missed (Bachs retries for ~80 minutes, then stops). */
export const bachsReconcile = functions.runWith({ secrets: BACHS_SECRETS, timeoutSeconds: 300 })
  .pubsub.schedule('every 60 minutes').onRun(async () => {
    if (!process.env.BACHS_SECRET_KEY) return null;
    const now = Date.now();
    const open = await db.collection('checkouts').where('status', '==', 'open').limit(200).get();
    for (const doc of open.docs) {
      const c = doc.data();
      const age = now - Date.parse(String(c.created_at));
      if (age < 10 * 60_000 || !c.bachs_checkout_id) continue;
      try {
        const s = parseCheckoutSession(await bachs().getCheckoutSession(String(c.bachs_checkout_id)));
        if (s?.paid && c.kind === 'plan' && s.subscriptionId) {
          await db.collection('users').doc(String(c.uid)).set({ bachs_subscription_id: s.subscriptionId, bachs_customer_id: s.customerId ?? null }, { merge: true });
          await doc.ref.update({ status: 'paid', settled_at: new Date().toISOString() });
          await syncSubscriptionById(s.subscriptionId, null, 'reconcile');
        } else if (s?.paid) {
          await applyOneOffPayment({ id: `reconcile:${doc.id}`, reference: doc.id, amountMinor: s.amountMinor, currency: s.currency, checkoutId: s.id }, 'reconcile');
        } else if ((s?.expired || age > 24 * 3_600_000)) {
          await doc.ref.update({ status: 'expired' });
        }
      } catch (e: any) { console.error('reconcile checkout', doc.id, e?.message || e); }
    }
    const subs = await db.collection('users').where('billing_mode', '==', 'subscription').limit(500).get();
    for (const u of subs.docs) {
      const id = u.data().bachs_subscription_id;
      if (!id) continue;
      try { await syncSubscriptionById(String(id), null, 'reconcile'); }
      catch (e: any) { console.error('reconcile subscription', id, e?.message || e); }
    }
    return null;
  });

/* Daily: naira pass reminders (5 days, 1 day) and expiry. */
export const passLifecycle = functions.pubsub.schedule('0 7 * * *').timeZone('Africa/Lagos').onRun(async () => {
  const cfg = await getPricingConfig();
  const nowIso = new Date().toISOString();
  const passes = await db.collection('users').where('billing_mode', '==', 'pass').get();
  for (const doc of passes.docs) {
    const a = doc.data() as Account & { email?: string };
    const planName = String(a.tier || 'Pro').charAt(0).toUpperCase() + String(a.tier || 'pro').slice(1);
    const expired = expirePass(a, nowIso);
    if (expired) {
      await doc.ref.update(expired);
      if (a.email) await sendTemplate(a.email, 'passExpired' as any, { planName });
      continue;
    }
    const due = reminderDue(a, nowIso);
    if (due && a.email) {
      const price = cfg.plans[(a.tier as Tier) || 'pro']?.priceNgn ?? 0;
      await sendTemplate(a.email, 'passReminder' as any, {
        planName, daysLeft: due, amount: price, currency: 'NGN',
        expiresAt: new Date(String(a.pass_expires_at)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      });
      await doc.ref.update({ pass_reminded: admin.firestore.FieldValue.arrayUnion(due) });
    }
  }
  return null;
});

/* Daily: if reconciliation had to grant anything, the webhook is not reaching us — say so. */
export const billingDailyCheck = functions.pubsub.schedule('0 8 * * *').timeZone('Africa/Lagos').onRun(async () => {
  const since = Date.now() - 24 * 3_600_000;
  const recon = await db.collection('payment_events').where('source', '==', 'reconcile').limit(500).get();
  const missed = recon.docs.filter((d: admin.firestore.QueryDocumentSnapshot) => (d.data().created_at?.toMillis?.() ?? 0) >= since);
  const reviews = await db.collection('billing_reviews').limit(500).get();
  const newReviews = reviews.docs.filter((d: admin.firestore.QueryDocumentSnapshot) => (d.data().created_at?.toMillis?.() ?? 0) >= since);
  if (missed.length || newReviews.length) {
    await billingAlertEmail('Daily billing check', [
      `${missed.length} payment(s) granted by reconciliation in the last 24h — the webhook missed them; check the endpoint in the Bachs dashboard (it is disabled after 72h of failures).`,
      `${newReviews.length} new item(s) in billing_reviews.`,
    ]);
  }
  return null;
});
```

- [ ] **Step 4: Revenue in the currency charged, combined only with a label (spec §2)** — in `growthDaily`, replace the `planPrice` / `mrr` lines with:

```ts
    const planPrice = (tier: string): number =>
      Number((DEFAULT_PRICING_CONFIG.plans as any)[tier]?.price ?? 0);
    const activePaying = paying.filter((u: any) => u.subscription_status === 'active');
    /* As charged: naira passes in naira, everything else in dollars. */
    const mrrUsd = activePaying.filter((u: any) => u.billing_currency !== 'NGN')
      .reduce((sum: number, u: any) => sum + planPrice(String(u.tier)), 0);
    const mrrNgn = activePaying.filter((u: any) => u.billing_currency === 'NGN')
      .reduce((sum: number, u: any) => sum + Number((DEFAULT_PRICING_CONFIG.plans as any)[u.tier]?.priceNgn ?? 0), 0);
    /* The ONE place the exchange rate is used: a single combined figure, stored beside the rate. */
    const mrr = Math.round((mrrUsd + mrrNgn / DEFAULT_PRICING_CONFIG.ngnPerUsd) * 100) / 100;
```

and in the `growth_daily` `set({...})` call, next to the existing `mrr` field, add:

```ts
      mrr_usd: mrrUsd,
      mrr_ngn: mrrNgn,
      mrr_combined_at_ngn_per_usd: DEFAULT_PRICING_CONFIG.ngnPerUsd,
```

Then add to `scripts/pricing.test.ts`:

```ts
ok(/mrr_combined_at_ngn_per_usd:\s*DEFAULT_PRICING_CONFIG\.ngnPerUsd/.test(serverSrc) && /mrr_ngn: mrrNgn/.test(serverSrc),
  'the growth report keeps naira and dollar revenue as charged, and labels the combined figure with its rate');
```

- [ ] **Step 5: Verify**

Run: `(cd functions && npx tsc --noEmit -p .) && npx tsx scripts/grants.test.ts && npx tsx scripts/bachs.test.ts && npx tsx scripts/pricing.test.ts`
Expected: all `PASS`.

- [ ] **Step 6: Commit**

```bash
git add functions/src/index.ts scripts/grants.test.ts scripts/pricing.test.ts
git commit -m "Bachs: hourly reconciliation, naira pass lifecycle, daily check, revenue as charged"
```

---

### Task 13: The client — ₦/$ toggle and real checkouts

**Files:**
- Modify: `services/billing.ts` (append)
- Modify: `pages/Pricing.tsx` (`select`, `ctaLabel`, price line, a toggle above the grid)
- Rewrite: `components/SubscriptionPanel.tsx`
- Modify: `components/TokenStore.tsx` (`buy`, price line, toggle, `closed`)
- Modify: `scripts/grants.test.ts` (TokenStore assertion now expects `startCheckout`)

**Interfaces:**
- Consumes: callables `createCheckout`, `manageBilling` (Task 10); `billingStatus` (Task 11).
- Produces (client): `type Currency`, `defaultCurrency(): Currency`, `formatPrice(major: number, currency: Currency): string`, `startCheckout(kind, item, currency): Promise<void>`, `callManageBilling(action, item?): Promise<{ url?: string }>`, `canPay(status: BillingStatus | null, role?: string): boolean`.

- [ ] **Step 1: Update the store assertion (fails until Step 5)** — in `scripts/grants.test.ts` replace the TokenStore check pair with:

```ts
ok(/fetchBillingStatus\(\)/.test(store) && /startCheckout\('pack'/.test(store), 'components/TokenStore.tsx buys packs through checkout, gated on billing status');
ok(!/callConfirmTopUp\(/.test(store), 'and never calls the refused confirmTopUp');
```

- [ ] **Step 2: Append to `services/billing.ts`**

```ts
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export type Currency = 'USD' | 'NGN';

/** ₦ for visitors whose browser says Nigeria; anyone can switch (spec §2). */
export const defaultCurrency = (): Currency => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const langs = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [];
    return tz === 'Africa/Lagos' || langs.some((l) => /-NG$/i.test(l)) ? 'NGN' : 'USD';
  } catch { return 'USD'; }
};

export const formatPrice = (major: number, currency: Currency): string =>
  currency === 'NGN' ? `₦${Math.round(major).toLocaleString('en-US')}` : `$${major}`;

/** Super-admins see checkout before launch; the server refuses everyone else (createCheckout). */
export const canPay = (status: BillingStatus | null, role?: string): boolean =>
  status?.billing_live === true || role === 'super_admin';

export const startCheckout = async (kind: 'plan' | 'pass' | 'pack', item: string, currency: Currency): Promise<void> => {
  const fn = httpsCallable(functions, 'createCheckout');
  const r = await fn({ kind, item, currency });
  const url = (r.data as { url?: string })?.url;
  if (!url) throw new Error('Checkout could not be started.');
  window.location.assign(url);
};

export const callManageBilling = async (action: 'cancel' | 'upgrade' | 'portal', item?: string): Promise<{ url?: string }> => {
  const fn = httpsCallable(functions, 'manageBilling');
  return (await fn({ action, item })).data as { url?: string };
};
```

Also change `fetchBillingStatus` so callers can get the whole object (it already returns `BillingStatus`; no change needed) and export the existing `BillingStatus` interface (already exported).

- [ ] **Step 3: Pricing page** — in `pages/Pricing.tsx`:
  - imports: replace `import { callChangeSubscription } from '../services/persistenceService';` with nothing, and change the billing import to `import { fetchBillingStatus, BillingStatus, Currency, defaultCurrency, formatPrice, canPay, startCheckout, callManageBilling } from '../services/billing';`
  - state: replace the `billingLive` state and effect with:

```ts
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [currency, setCurrency] = useState<Currency>(defaultCurrency());
  useEffect(() => {
    let alive = true;
    void fetchBillingStatus().then((s) => { if (alive) setBilling(s); });
    return () => { alive = false; };
  }, []);
  const payable = canPay(billing, profile?.role);
```

  - replace the body of `select` after `if (tier === 'free') { navigate('/'); return; }` with:

```ts
      if (!payable) {
        setMsg('Card payments are not live yet. Email support and we will set your plan up by hand.');
        return;
      }
      if (tier === 'enterprise') { navigate('/enterprise'); return; }
      setBusy(tier);
      if (currency === 'USD' && profile?.billing_mode === 'subscription') {
        await callManageBilling('upgrade', tier);
        setMsg('Upgrade requested — your plan changes as soon as Bachs confirms the payment.');
        return;
      }
      await startCheckout(currency === 'USD' ? 'plan' : 'pass', tier, currency);
```

  - in `ctaLabel`, replace `if (billingLive === false && tier !== 'free') return 'Talk to us';` with `if (!payable && tier !== 'free') return 'Talk to us';`, and the final return with `return currency === 'NGN' ? \`Get ${PLAN_META[tier].name} — 30 days\` : \`Upgrade to ${PLAN_META[tier].name}\`;`
  - replace the price line `${plan.price}<span …>/mo</span>` with:

```tsx
{currency === 'NGN' && plan.priceNgn ? formatPrice(plan.priceNgn, 'NGN') : formatPrice(plan.price, 'USD')}
<span className="text-base font-medium text-gray-600">{currency === 'NGN' && plan.priceNgn ? '/30 days' : '/mo'}</span>
```

  - above the plan grid (first child of the `index={1}` section) add the toggle:

```tsx
        <div className="flex justify-center mb-8" role="group" aria-label="Currency">
          {(['NGN', 'USD'] as Currency[]).map((c) => (
            <button key={c} type="button" onClick={() => setCurrency(c)} aria-pressed={currency === c}
              className={`px-5 py-2 text-[11px] font-bold uppercase tracking-widest border border-gray-800 first:rounded-l-xl last:rounded-r-xl ${currency === c ? 'bg-white text-[#0B0B0B]' : 'text-gray-400'}`}>
              {c === 'NGN' ? '₦ Naira' : '$ Dollars'}
            </button>
          ))}
        </div>
        {currency === 'NGN' && <p className="text-center text-xs text-gray-500 mb-8">Naira plans are 30-day passes: pay once, no automatic charge. We email you before it ends.</p>}
```

  - extend the `UserProfile` type in `types.ts` with `billing_mode?: 'subscription' | 'pass' | null; pass_expires_at?: string | null; bachs_customer_id?: string | null;` so `profile?.billing_mode` typechecks.

- [ ] **Step 4: Rewrite `components/SubscriptionPanel.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { Card, PrimaryButton, SecondaryButton, Badge, SuccessMessage, ErrorMessage, useConfirmTap } from './UI';
import { useAuth } from '../context/AuthContext';
import { isPaidTier } from '../config/access';
import { SubscriptionStatus } from '../types';
import { DEFAULT_PRICING_CONFIG, PLAN_META } from '../config/pricingConfig';
import { track } from '../services/analytics';
import { fetchBillingStatus, BillingStatus, Currency, defaultCurrency, formatPrice, canPay, startCheckout, callManageBilling } from '../services/billing';

const PRO = DEFAULT_PRICING_CONFIG.plans.pro;

type BadgeTone = 'neutral' | 'red' | 'green' | 'blue' | 'yellow' | 'dark';
const STATUS_BADGE: Record<SubscriptionStatus, { label: string; tone: BadgeTone }> = {
  free: { label: 'Free', tone: 'neutral' },
  active: { label: 'Active', tone: 'green' },
  past_due: { label: 'Past due', tone: 'yellow' },
  cancelled: { label: 'Cancelled', tone: 'yellow' },
  expired: { label: 'Expired', tone: 'red' },
};

/**
 * The account's plan and what can be done with it (spec §5). Every money action goes to Bachs:
 * a checkout for a new plan or pass, `manageBilling` for a USD subscription. Nothing here changes
 * a tier — the webhook does, once Bachs confirms the payment.
 */
const SubscriptionPanel: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [msgErr, setMsgErr] = useState(false);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [currency, setCurrency] = useState<Currency>(defaultCurrency());

  useEffect(() => {
    let alive = true;
    void fetchBillingStatus().then((s) => { if (alive) setBilling(s); });
    const q = new URLSearchParams(window.location.search).get('checkout');
    if (q === 'success') { setMsg('Payment received — your plan updates within a minute.'); void refreshProfile(); }
    if (q === 'cancelled') { setMsgErr(true); setMsg('Checkout was cancelled. Nothing was charged.'); }
    return () => { alive = false; };
    /* Runs once on mount. Listing refreshProfile here would loop if it is not memoised:
       refresh → new profile → new function → effect → refresh. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelTap = useConfirmTap(() => act('cancel'));
  if (!profile) return null;

  const planName = PLAN_META[profile.tier]?.name || profile.tier;
  const planTokens = DEFAULT_PRICING_CONFIG.plans[profile.tier]?.monthlyTokens ?? PRO.monthlyTokens;
  const status: SubscriptionStatus = profile.subscription_status || (isPaidTier(profile.tier) ? 'active' : 'free');
  const badge = STATUS_BADGE[status] || STATUS_BADGE.free;
  const isPaid = isPaidTier(profile.tier);
  const isPass = profile.billing_mode === 'pass';
  const isSub = profile.billing_mode === 'subscription';
  const payable = canPay(billing, profile.role);
  const proPrice = currency === 'NGN' ? formatPrice(PRO.priceNgn ?? 0, 'NGN') + ' for 30 days' : formatPrice(PRO.price, 'USD') + '/mo';

  async function act(action: 'buy-pro' | 'renew-pass' | 'cancel' | 'portal') {
    if (!user) return;
    setBusy(action); setMsg(''); setMsgErr(false);
    try {
      if (action === 'buy-pro') {
        track('upgrade_clicked', { plan: 'pro', surface: 'subscription_panel', signed_in: true });
        await startCheckout(currency === 'USD' ? 'plan' : 'pass', 'pro', currency);
      } else if (action === 'renew-pass') {
        await startCheckout('pass', String(profile!.tier), 'NGN');
      } else if (action === 'portal') {
        const r = await callManageBilling('portal');
        if (r.url) window.location.assign(r.url);
      } else {
        await callManageBilling('cancel');
        await refreshProfile();
        setMsg('Cancelled. You keep access until the end of the period.');
      }
    } catch (e: any) {
      setMsgErr(true); setMsg(e.message || 'That did not work.');
    } finally { setBusy(''); }
  }

  const ends = profile.pass_expires_at || profile.plan_renews_at;

  return (
    <Card title="Subscription">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-[#0B0B0B]">{planName}</span>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>
        {isPaid && ends && (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">
            {isPass ? 'Ends' : status === 'cancelled' ? 'Access until' : 'Renews'} {new Date(ends).toLocaleDateString()}
          </p>
        )}
      </div>

      <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
        {!isPaid && `Your Free allowance is a one-time balance and does not refill. ${PLAN_META.pro.name} gives you ${PRO.monthlyTokens} tokens every month and the ability to top up.`}
        {isPass && `Your ${planName} pass includes ${planTokens} tokens. It does not renew by itself — renewing early adds 30 days to the end.`}
        {isSub && status !== 'cancelled' && `${planName} renews monthly and includes ${planTokens} tokens each period. Purchased tokens never expire.`}
        {isSub && status === 'cancelled' && `Your ${planName} plan is cancelled and will not renew. You keep access until the end of the period.`}
        {isPaid && !isPass && !isSub && `${planName} was set up by our team. Contact support to change it.`}
      </p>

      {!payable && (isPaid ? isPass : true) && (
        <p className="text-sm text-gray-500 mb-6">Card payments are not live yet. Email support and we will set your plan up by hand.</p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {payable && !isPaid && (
          <>
            <div className="flex" role="group" aria-label="Currency">
              {(['NGN', 'USD'] as Currency[]).map((c) => (
                <button key={c} type="button" onClick={() => setCurrency(c)} aria-pressed={currency === c}
                  className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest border border-gray-200 first:rounded-l-lg last:rounded-r-lg ${currency === c ? 'bg-[#0B0B0B] text-white' : 'text-gray-500'}`}>
                  {c === 'NGN' ? '₦' : '$'}
                </button>
              ))}
            </div>
            <PrimaryButton size="md" onClick={() => act('buy-pro')} disabled={!!busy}>
              {busy === 'buy-pro' ? 'Opening checkout…' : `Get ${PLAN_META.pro.name}, ${proPrice}`}
            </PrimaryButton>
          </>
        )}
        {payable && isPass && (
          <PrimaryButton size="md" onClick={() => act('renew-pass')} disabled={!!busy}>
            {busy === 'renew-pass' ? 'Opening checkout…' : 'Renew pass (+30 days)'}
          </PrimaryButton>
        )}
        {isSub && (
          <>
            <SecondaryButton onClick={() => act('portal')} disabled={!!busy}>{busy === 'portal' ? 'Opening…' : 'Update card'}</SecondaryButton>
            {status !== 'cancelled' && (
              <SecondaryButton onClick={cancelTap.tap} disabled={!!busy} className={cancelTap.armed ? '!border-[#FF0000] !text-[#FF0000]' : ''}>
                {busy === 'cancel' ? 'Cancelling…' : cancelTap.armed ? 'Tap again to cancel' : 'Cancel plan'}
              </SecondaryButton>
            )}
          </>
        )}
      </div>

      {msg && (msgErr ? <ErrorMessage message={msg} className="mt-6" /> : <SuccessMessage message={msg} className="mt-6" />)}
    </Card>
  );
};

export default SubscriptionPanel;
```

  If `profile.role` is not on `UserProfile`, add `role?: string;` alongside the fields added in Step 3.

- [ ] **Step 5: Token store** — in `components/TokenStore.tsx`:
  - import `{ fetchBillingStatus, BillingStatus, Currency, defaultCurrency, formatPrice, canPay, startCheckout }` from `../services/billing`;
  - replace the `billingLive` state/effect with `billing` + `currency` state exactly as in Step 4, and `const closed = !canPay(billing, profile?.role);`;
  - replace the `buy` body after the free-tier line with:

```ts
    if (closed) { setMsgErr(false); setMsg('Token packs open when payments go live.'); return; }
    setBusy(packId); setMsgErr(false); setMsg('Opening checkout…');
    try { await startCheckout('pack', packId, currency); }
    catch (e: any) { setMsgErr(true); setMsg(e.message || 'Checkout could not be started.'); setBusy(null); }
```

  - replace the price line `${p.price}` with `{currency === 'NGN' && p.priceNgn ? formatPrice(p.priceNgn, 'NGN') : formatPrice(p.price, 'USD')}`;
  - add the same two-button currency toggle above the pack grid.

- [ ] **Step 6: Verify**

Run: `npx tsc && npx tsx scripts/grants.test.ts && npx tsx scripts/analytics.test.ts && npx tsx scripts/bachs.test.ts && node scripts/routes.test.mjs`
Expected: no tsc output; all `PASS`. Then the full build:
Run: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`
Expected: every guard `PASS`, `Prerender complete`.

- [ ] **Step 7: Render check** — start `npx vite --port 5199`, open `/pricing` at 1280 and 390 widths with Puppeteer (pattern: `scripts/browser-harness.ts`), screenshot, and confirm: the toggle shows, naira prices read `₦9,900/30 days`, `₦39,000`, `₦120,000`, no horizontal overflow. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add services/billing.ts pages/Pricing.tsx components/SubscriptionPanel.tsx components/TokenStore.tsx types.ts scripts/grants.test.ts
git commit -m "Client: ₦/$ toggle, Bachs checkout for plans, passes and packs, billing actions"
```

---

### Task 14: Sandbox deploy and end-to-end test (needs the founder for two dashboard steps)

**Files:** none committed beyond fixes found here.

- [ ] **Step 1: Secrets** — from `functions/` (values never echoed):

```bash
node -e "const l=require('fs').readFileSync('.secret.local','utf8').split(/\r?\n/).find(x=>x.startsWith('BACHS_SECRET_KEY='));require('fs').writeFileSync('.k.tmp',l.slice(17).trim())"
npx firebase functions:secrets:set BACHS_SECRET_KEY --data-file .k.tmp --project marketbrainosweb; rm .k.tmp
printf 'unset' > .w.tmp && npx firebase functions:secrets:set BACHS_WEBHOOK_SECRET --data-file .w.tmp --project marketbrainosweb; rm .w.tmp
```

Expected: two `Created a new secret version` lines.

- [ ] **Step 2: Deploy functions** — `cd .. && npm --prefix functions run build && FUNCTIONS_DISCOVERY_TIMEOUT=60 npx firebase deploy --only functions,firestore:rules --project marketbrainosweb`
Expected: every function `Successful`; `paystackWebhook` reported deleted (answer the prompt to delete it, or pass `--force` only after confirming the list shows only `paystackWebhook`).

- [ ] **Step 3: Founder — register the webhook** in the Bachs **sandbox** dashboard (Developers → Webhooks): URL `https://us-central1-marketbrainosweb.cloudfunctions.net/bachsWebhook`, events: checkout.completed, checkout.expired, collection.succeeded, invoice.paid, invoice.payment_failed, customer.subscription.created/updated/deleted, refund.*, dispute.*. Copy the signing secret into `functions/.w.tmp` (one line), then:

```bash
cd functions && npx firebase functions:secrets:set BACHS_WEBHOOK_SECRET --data-file .w.tmp --project marketbrainosweb && rm .w.tmp
cd .. && FUNCTIONS_DISCOVERY_TIMEOUT=60 npx firebase deploy --only functions:bachsWebhook --project marketbrainosweb
```

- [ ] **Step 4: Push the site** — `git push origin HEAD`; wait for Vercel `Ready` (`vercel inspect <url>`), confirm `/pricing` serves.

- [ ] **Step 5: End-to-end, signed in as a super-admin** — for each row, do it, then check Firestore `users/{uid}`, `payments`, `payment_events`, `checkouts` and the inbox:

| # | Action | Expected |
|---|---|---|
| 1 | Token store (on an admin-granted Pro account): Starter pack, ₦, sandbox transfer "succeed" | `purchased_tokens` +100; `payments` 500000 NGN; one ledger `checkout:`; receipt email ₦5,000 |
| 2 | Same with $ and a sandbox card | +100; 1000 USD; receipt $10.00 |
| 3 | Free account: Pro pass ₦ | tier pro, `billing_mode: pass`, `pass_expires_at` +30d, 300 tokens |
| 4 | Renew the pass immediately | `pass_expires_at` +60d from step 3, one more ledger entry |
| 5 | Free account: Pro $ with card `4242…` (Bachs success card) | after `invoice.paid`: tier pro, `billing_mode: subscription`, ledger `period:…:prod_…` |
| 6 | Update card → portal opens | Bachs portal URL loads |
| 7 | Upgrade to Team from Pricing | after prorated invoice: tier team, new `period:` key ending `:prod_t…` |
| 8 | Cancel plan | `subscription_status: cancelled`, tier unchanged |
| 9 | Pay with decline card `4000000000000002` | nothing granted; checkout stays `open`, later `expired` |
| 10 | Replay a delivered event from the Bachs dashboard | response `already handled`; nothing changes |
| 11 | Set `pass_expires_at` of the step-3 account to yesterday in Firestore, run `passLifecycle` from Cloud Scheduler "Force run" | tier free, monthly 0, purchased kept, `passExpired` email |

Any field-name difference found (e.g. Bachs uses `period_start` not `current_period_start`) is fixed in `events.ts` **with a test added to `scripts/bachs.test.ts` first**, then committed and redeployed.

- [ ] **Step 6: Commit any fixes** with a message that states how many of the 11 rows passed and names each fix (for example `Bachs sandbox end-to-end: 11/11 rows pass; events.ts reads period_start`). A row that cannot pass yet (e.g. USD rows while Bachs has not enabled subscriptions) is listed as blocked with the reason, not counted as passed.

---

### Task 15: Go live (founder-led checklist)

- [ ] Bachs support has confirmed: subscriptions enabled on the live account; reserve and licensing questions answered (private research file).
- [ ] `BACHS_SECRET_KEY=<live>` exported in the shell only, then `npx tsx scripts/bachs/setup.ts` → three live product ids; set them as `BACHS_PRODUCT_*` in `functions/.env`.
- [ ] Live key into Secret Manager (`functions:secrets:set BACHS_SECRET_KEY --data-file`, temp file deleted); live webhook registered in the **live** dashboard; its secret into `BACHS_WEBHOOK_SECRET`.
- [ ] `BILLING_LIVE=true` in `functions/.env`; deploy all functions.
- [ ] Founder buys one real ₦9,900 Pro pass and one real $19 subscription (then cancels it); both appear in `payments` with the correct currency and amount.
- [ ] Watch `billingDailyCheck` emails for the first week.
