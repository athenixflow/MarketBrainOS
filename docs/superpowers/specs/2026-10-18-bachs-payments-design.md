# Bachs payments — design

**Date:** 2026-10-18 · **Status:** approved in conversation section by section; awaiting review of this written spec.
**Replaces:** the Paystack integration (`functions/src/paystack.ts`, `paystackWebhook`, `scripts/paystack.test.ts`), which never took a payment.
**Prerequisite, already shipped:** `39b481b` — no user-facing callable can grant a plan, tokens, capacity or a refill (`scripts/grants.test.ts`).
**Vendor research:** private, in `docs/gtm/bachs-research.md` (gitignored) — commercial terms and open questions for Bachs are kept there, not in this public repo.

## 1. Goal

MarketBrain OS takes real money through Bachs, in US dollars and Nigerian naira, and a verified Bachs payment is the **only** way a customer's plan or token balance changes (admin tools aside).

**In scope (v1)**
- USD plans Pro / Team / Agency as monthly Bachs subscriptions.
- Naira plans as one-off **30-day passes** (Bachs cannot bill NGN subscriptions: `NGN_SUBSCRIPTIONS_NOT_ENABLED`).
- Token packs as one-off payments in either currency, for accounts on a paid plan (today's rule).
- Cancel at period end, card updates through the Bachs portal, failed-payment handling, renewal reminders for passes.

**Out of scope (v1)** — paid expansions (extra seat / workspace / agency; `purchaseExpansion` stays closed), quarterly and annual billing, the Bachs inline overlay, automated refund and dispute handling, true NGN auto-renewal (revisit when Bachs supports it).

## 2. Decisions

| Decision | Choice |
|---|---|
| Provider | Bachs replaces Paystack entirely. |
| Architecture | Server creates every checkout from our own price config; the signed webhook is the only grant path; an hourly job re-syncs state from Bachs. |
| Naira plans | 30-day pass, early renewal stacks, reminder emails, no auto-charge. |
| Currency choice | ₦ / $ toggle on pricing and checkout; defaults to ₦ when the browser's timezone or language indicates Nigeria. Anyone may switch. |
| Naira prices | Local, not converted: Pro ₦9,900 · Team ₦39,000 · Agency ₦120,000 (GTM part 15). Packs: Starter 100 ₦5,000 · Growth 500 ₦20,000 · Business 1,500 ₦50,000 · Agency 5,000 ₦150,000 · Enterprise 10,000 ₦250,000. |
| Exchange rate | `ngnPerUsd: 1450` in the pricing config, used **only** where both currencies must become one number (e.g. a combined revenue total), always labelled "converted at ₦1,450/$" and shown beside the as-charged totals. Payments and reports are kept in the currency charged. |
| Paid extras | Later. |

## 3. Components

**New — `functions/src/bachs/`** (pure modules, testable without a Bachs account or Firestore)
- `signature.ts` — verifies `X-Bachs-Signature-V2` (`t={timestamp},v1={sig}`; any `v1` may match during secret rotation): hex HMAC-SHA256 of `"{t}.{raw body}"` with the webhook secret, timing-safe, rejects `|now − t| > 300s`. Raw bytes only; never a re-serialised body.
- `events.ts` — maps Bachs events to our set: `checkout.completed`, `collection.succeeded` → **one-off paid**; `invoice.paid` → **subscription period paid**; `invoice.payment_failed` → **payment failed**; `customer.subscription.updated` / `.deleted` → **subscription state**; `refund.*`, `dispute.*` → **flag for review**; everything else → ignored. Malformed input returns null, never throws.
- `catalog.ts` — what can be bought: `(kind: 'plan' | 'pass' | 'pack', item, currency) → amountMinor` (kobo / cents), read from the pricing config. Unknown combination → null. USD plans resolve to Bachs product ids from config.
- `grant.ts` — the grant logic as a **pure function**: `(account, payment, checkoutRecord, config, now) → { update, paymentRecord, review? }`. Every rule in §5 lives here.
- `api.ts` — thin `fetch` wrapper over `https://api.bachs.io/v1` (sandbox: `https://sandbox-api.bachs.io/v1`), bearer key, `Idempotency-Key` on every POST/PATCH/DELETE, honours `Retry-After`. No `@bachs/sdk` dependency (published the day before this design; lacks PATCH/refunds). Loaded only inside functions, never by build-time scripts (`scripts/deploy.test.mjs`).

**New — Cloud Functions** (`functions/src/index.ts`, v1 API like the rest)
- `createCheckout` (callable) — input `{ kind, item, currency }`. Refuses unless billing is live **or** the caller's role is `super_admin` (the server half of the sandbox-testing rule in §3 "Changed"). Validates against the catalog and the account (paid plan required for packs; a lower pass refused while a higher one is active), writes `checkouts/{reference}`, creates a Bachs checkout session, returns `{ url }`.
- `manageBilling` (callable) — `cancel` (USD subscription: `DELETE /v1/subscriptions/{id}` with `cancel_at_period_end: true`), `upgrade` (USD: `PATCH /v1/subscriptions/{id}` `{ product_id, proration_behavior: 'invoice_now' }`), `portal` (`POST /v1/customers/{id}/portal-sessions` → `{ url }`). Naira passes have nothing to cancel.
- `bachsWebhook` (HTTP) — §6.
- `bachsReconcile` (scheduled, hourly) — §6.
- `passLifecycle` (scheduled, daily) — reminder emails at 5 days and 1 day before `pass_expires_at`; at expiry, tier → `free`, monthly allowance → 0, purchased tokens kept.
- `billingDailyCheck` (scheduled, daily, first 30 days after launch) — compares Bachs payments with `payments`, and the webhook endpoint's health, and emails the founder any mismatch.

**New — script** `scripts/bachs/setup.ts` — idempotently creates the three USD monthly products in Bachs (matched by our own key in product metadata) and prints their ids for config. Run once per environment.

**Changed**
- `config/pricingConfig.ts` (+ server copy): naira prices for plans and packs, `ngnPerUsd`, Bachs USD product ids per environment. `scripts/pricing.test.ts` covers both copies and both currencies.
- `functions/src/index.ts` `billingLive` → `Boolean(BACHS_SECRET_KEY) && BILLING_LIVE === 'true'`; `billingStatus` reports `provider: 'bachs'`. **Super-admin accounts see checkout buttons even while not live** (for sandbox testing on the real site).
- `monthlyTokenRefresh` skips accounts whose `billing_mode` is `subscription` or `pass` — their allowance resets only when money arrives.
- `pages/Pricing.tsx`, `components/SubscriptionPanel.tsx`, `components/TokenStore.tsx`: ₦/$ toggle, call `createCheckout` / `manageBilling`, redirect to the returned URL.
- Retired: `functions/src/paystack.ts`, `paystackWebhook`, `scripts/paystack.test.ts` and its build entry.

## 4. Data

- `checkouts/{reference}` — written by `createCheckout`: `uid, kind, item, currency, amount_minor, bachs_checkout_id, status (open | paid | expired | review), created_at`. `reference` = `mb_` + random id (unique per Bachs organisation, ≤128 chars). **The webhook trusts this record, not the event, for who and what.**
- `payment_events/{key}` — the once-only ledger, keyed by **business identity**: `checkout:{reference}` for one-off payments; `period:{subscription_id}:{current_period_start}` for subscription periods; `event:{evt_id}` for state-only events. Written in the same transaction as the grant.
- `payments/{auto}` — immutable record: `uid, provider 'bachs', kind, item, amount_minor, currency (as charged), bachs ids, tokens_credited, created_at`.
- `users/{uid}` gains `billing_currency, billing_mode ('subscription' | 'pass'), pass_expires_at, bachs_customer_id, bachs_subscription_id, bachs_last_event_at`.
- `billing_reviews/{auto}` — anything not granted: amount/currency mismatch, unknown reference, refund, dispute. Each one emails the founder.

## 5. Money paths (rules in `grant.ts`)

**USD subscription**
- **Every subscription grant comes from `invoice.paid` (or reconciliation), keyed `period:{sub}:{start}`.** `checkout.completed` with mode `subscription` grants nothing: it only links `bachs_customer_id` / `bachs_subscription_id` to the account named in the `checkouts` record. Both events arrive for a first payment, so granting on both would double-grant.
- First period paid: tier = item, `billing_mode: 'subscription'`, allowance = plan monthly tokens, `plan_renews_at` = Bachs `current_period_end`.
- Renewal (`invoice.paid`, new period): allowance reset; `plan_renews_at` advanced. Key `period:{sub}:{start}`.
- Upgrade: `manageBilling('upgrade')` → Bachs prorates and invoices; tier changes when that invoice is paid.
- Cancel: `subscription_status: 'cancelled'`, access kept; on `customer.subscription.deleted` → tier `free`, monthly allowance 0, purchased kept.
- Failed payment: `past_due`, access kept during Bachs retries (~9 days); subscription ends → as cancel.

**Naira pass**
- Payment: tier = item, `billing_mode: 'pass'`, allowance = plan monthly tokens, `pass_expires_at = max(now, current expiry if same tier) + 30 days`.
- Upgrade (higher tier while active): fresh 30 days of the new tier from now; checkout states that the old pass is not refunded.
- Lower tier while a higher pass is active: refused at `createCheckout`.
- Expiry: handled by `passLifecycle`.

**Token pack** (either currency, paid plan required at checkout): `purchased_tokens += pack tokens`; existing `tokenReceipt` email.

**All paths:** amount and currency must equal the `checkouts` record (one-off) or the configured product (subscription), else → `billing_reviews`, nothing granted.

## 6. Webhook, reconciliation, failure handling

- No `rawBody` → 400. Bad or stale signature → 401 with no detail.
- Parse → null → 200 "ignored".
- Grant runs in one Firestore transaction: read `payment_events/{key}`; if present → 200 "already handled"; else apply `grant.ts` output and write the ledger entry together. A failure rolls back both, so Bachs' retry re-applies cleanly (fixes the mark-first bug in the Paystack handler).
- Out-of-order: a subscription-state event older than `bachs_last_event_at` is ignored.
- Status codes: transient Firestore errors → 500 (Bachs retries: 5 attempts over ~80 min); everything else → 200.
- `bachsReconcile` (hourly), state-based because Bachs offers no event listing: for `checkouts` open > 10 min, `GET /v1/checkout-sessions/{id}`; if paid and not in the ledger, apply through the same function (same `checkout:` key). For accounts with a subscription, `GET /v1/subscriptions/{id}`; if the period start is newer than recorded and status is active, apply the renewal (same `period:` key); if canceled, apply the end. Checkouts open > 24 h → `expired`.
- Bachs disables an endpoint after 72 h of failures and does not re-send that period: `billingDailyCheck` alerts on endpoint health; reconciliation covers the gap.
- Currency vs apparent country mismatches are logged to `payments` for review only.

**Secrets:** sandbox keys in `functions/.env` (gitignored) for local runs. Deployed: `BACHS_SECRET_KEY` and `BACHS_WEBHOOK_SECRET` in Google Secret Manager, bound with `runWith({ secrets })` to `createCheckout`, `manageBilling`, `bachsWebhook`, `bachsReconcile`, `billingDailyCheck` only. The live key is never used for development or tests.

## 7. Testing

Build-wired, each shown failing on a planted bug before it is kept:
- `scripts/bachs.test.ts` — signature (valid; tampered body; wrong secret; stale and future timestamp; missing header; rotation with two `v1`); event mapping incl. malformed; catalog amounts in both currencies; **`grant.ts` for every rule in §5** (first payment, renewal, upgrade, cancel, past due, ended; first pass, stacking, upgrade mid-pass, lower pass refused, expiry; mismatch → review; duplicate key → no-op; older event → ignored).
- `scripts/grants.test.ts` — extended: only `bachsWebhook`, `bachsReconcile`, `passLifecycle` (downgrade only) and admin callables may write a tier, allowance or token credit.
- `scripts/pricing.test.ts` — naira prices in both copies; no pack undercuts a plan in either currency; `ngnPerUsd` present.
- `scripts/deploy.test.mjs` — unchanged rule, covers the new modules.

## 8. Rollout

1. Deploy with **sandbox** keys, `BILLING_LIVE` off. Paystack removed in this release. Customers see no change; super-admins see checkout.
2. Sandbox end-to-end on the live site, every path in §5, with Bachs test cards/transfers; verify account, `payments`, ledger and email each time.
3. Confirm with Bachs support the open questions in the private research file (subscription access on the account, reserve, licensing).
4. `scripts/bachs/setup.ts` against the live account; live secrets into Secret Manager; one real ₦ Pro pass and one real $19 subscription (then cancelled) by the founder.
5. `BILLING_LIVE=true`. `billingDailyCheck` runs for 30 days.

## 9. Known limits

- Naira plans do not auto-renew until Bachs ships NGN subscriptions.
- Refunds and disputes are manual (admin tools) in v1.
- A non-Nigerian can choose naira; they need a Nigerian payment method to pay. Logged, not blocked.
