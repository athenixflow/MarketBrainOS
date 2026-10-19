import { Currency, Kind, PaidTier, PricingLike, TIER_RANK, catalogItem } from './catalog';
import { BachsEvent, SubscriptionSnapshot } from './events';

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

/* TIER_RANK is a plain object, so TIER_RANK['constructor'] is a function; only an own key is a tier. */
const rank = (tier: string | undefined): number => {
  const t = tier || 'free';
  return Object.prototype.hasOwnProperty.call(TIER_RANK, t) ? TIER_RANK[t] : 0;
};
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
  /* A payment STACKS onto an active pass of the same tier: 30 more days from its expiry, and the
     new month's allowance is ADDED to what is left (monthlyTokenRefresh skips pass accounts, so
     replacing it would drop the second month of two payments, or throw away the tokens left on an
     early renewal). A first pass, a pass that has ended, or an upgrade to a higher tier starts 30
     days from now with a fresh allowance of the new tier; the old pass is not refunded. */
  const stacks = passOn && account.tier === checkout.item;
  const from = stacks ? Date.parse(account.pass_expires_at as string) : nowMs;
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
      ...balanceFields(stacks ? monthly + item.tokens : item.tokens, purchased),
    },
  };
};

export const reminderDue = (a: Account, nowIso: string): 5 | 1 | null => {
  if (a.billing_mode !== 'pass' || !a.pass_expires_at) return null;
  const daysLeft = (Date.parse(a.pass_expires_at) - Date.parse(nowIso)) / DAY_MS;
  const sent = Array.isArray(a.pass_reminded) ? a.pass_reminded : [];
  if (daysLeft <= 0) return null;
  /* With ≤1 day left only the 1-day reminder can be due: a "5 days left" email must never go
     out then, even if that reminder was missed (a skipped cron run). */
  if (daysLeft <= 1) return sent.includes(1) ? null : 1;
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
  snap: SubscriptionSnapshot,
  tier: PaidTier | null,
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

  /* A naira pass can still be live when a dollar subscription activates: two checkouts opened in
     two tabs (checkoutAllowed only blocks them one after the other). The customer chose and paid
     for the subscription, so it is granted; but its tier, allowance and mode replace the pass, so
     the unused pass days are paid-for value we cannot honour. Clear the pass (the expiry job must
     never drop a subscriber to Free) and flag it, so the founder can refund those days.
     "Live" is judged at the moment the paid period began — pure, no clock — falling back to now
     only when Bachs sent no period start. */
  const startMs = Date.parse(snap.currentPeriodStart ?? '');
  const overlapsPass = activePass(account, Number.isNaN(startMs) ? Date.now() : startMs);
  return {
    stateUpdate,
    grant: {
      ledgerKey,
      review: overlapsPass
        ? `dollar subscription started while a ${account.tier ?? 'paid'} naira pass was still active (pass_expires_at ${account.pass_expires_at}); refund the unused pass days`
        : null,
      checkoutStatus: null,
      userUpdate: {
        tier, billing_mode: 'subscription', ...balanceFields(item.tokens, purchased),
        ...(overlapsPass ? { pass_expires_at: null, pass_reminded: [] } : {}),
      },
      payment: { kind: 'plan', item: tier, amount_minor: chargedMinor ?? item.amountMinor, currency: 'USD', tokens_credited: item.tokens },
    },
  };
};
