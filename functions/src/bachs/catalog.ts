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
