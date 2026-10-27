import { DEFAULT_PRICING_CONFIG, PLAN_META, PLAN_ORDER, Tier } from '../config/pricingConfig';

/**
 * What the billing surfaces offer, decided in one pure place (no Firebase, so scripts/bachs.test.ts
 * proves each rule). services/billing.ts re-exports formatPrice from here; the pages call these.
 */

export type Currency = 'USD' | 'NGN';

/** The fields of a profile these rules read. */
export interface BillingProfile {
  tier?: string;
  billing_mode?: string | null;
  pass_expires_at?: string | null;
  subscription_status?: string;
}

export const formatPrice = (major: number, currency: Currency): string =>
  currency === 'NGN' ? `₦${Math.round(major).toLocaleString('en-US')}` : `$${major}`;

/**
 * Shown beside dollar prices to a buyer whose browser says Nigeria and who switched to dollars:
 * their card is charged in USD (createCheckout pins billing_currency), not converted to naira.
 */
export const usdChargeNote = (localCurrency: Currency, selected: Currency): string | null =>
  localCurrency === 'NGN' && selected === 'USD' ? 'Charged in USD' : null;

const naira = (tier: string): number | undefined =>
  Object.prototype.hasOwnProperty.call(DEFAULT_PRICING_CONFIG.plans, tier)
    ? DEFAULT_PRICING_CONFIG.plans[tier as Tier].priceNgn
    : undefined;

/**
 * Is choosing `tier` in `currency` RENEWING this account's naira pass? The passReminder and
 * passExpired emails link to /billing, and from there to /pricing: the holder's own tier must be
 * a way to pay again, not a disabled "Current plan". A dollar subscriber's own tier never is.
 */
export const isPassRenewal = (profile: BillingProfile | null | undefined, tier: string, currency: Currency): boolean =>
  !!profile && currency === 'NGN' && profile.billing_mode === 'pass' && profile.tier === tier && Number(naira(tier)) > 0;

const DAY_MS = 86_400_000;
const rank = (tier: string | undefined): number => PLAN_ORDER.indexOf((tier || 'free') as Tier);
const planName = (tier: string | undefined): string => PLAN_META[(tier || 'free') as Tier]?.name || String(tier);

/**
 * What a buyer must agree to before a HIGHER naira pass replaces the one still running (spec §5): the
 * new tier starts today with a fresh allowance, and the old pass's days and tokens are not refunded
 * (bachs/grant.ts applyOneOff). Null when nothing is replaced: no live pass, the same tier (that
 * stacks), a lower tier (the server refuses it), or a tier with no naira pass.
 */
export const passReplaceNotice = (profile: BillingProfile | null | undefined, tier: string, now: Date): string | null => {
  if (!profile || profile.billing_mode !== 'pass' || !profile.pass_expires_at) return null;
  const left = Date.parse(profile.pass_expires_at) - now.getTime();
  if (!(left > 0) || rank(tier) <= rank(profile.tier) || !(Number(naira(tier)) > 0)) return null;
  const days = Math.ceil(left / DAY_MS);
  return `Your ${planName(profile.tier)} pass has ${days} ${days === 1 ? 'day' : 'days'} left. `
    + `${planName(tier)} starts today and replaces it; unused days and tokens aren't refunded.`;
};

/**
 * Where a Bachs checkout sends the customer back: /billing?checkout=success&for=pack. Bachs appends
 * "?checkout_id=…" to that URL literally, so a value can arrive as "success?checkout_id=chk_1" or
 * "pack?checkout_id=chk_1"; only what comes before a "?" is read.
 */
export const checkoutReturn = (search: string): { outcome: 'success' | 'cancelled' | null; kind: 'plan' | 'pass' | 'pack' | null } => {
  const params = new URLSearchParams(search);
  const read = (name: string) => (params.get(name) || '').split('?')[0];
  const outcome = read('checkout');
  const kind = read('for');
  return {
    outcome: outcome === 'success' || outcome === 'cancelled' ? outcome : null,
    kind: kind === 'plan' || kind === 'pass' || kind === 'pack' ? kind : null,
  };
};

/**
 * Why a dollar subscription cannot be upgraded right now, or null — the page's copy of the server's
 * rule (functions/src/bachs/grant.ts upgradeRefusal), so the button is not offered only to be refused.
 */
export const subscriptionUpgradeBlock = (profile: BillingProfile | null | undefined): string | null => {
  if (!profile || profile.billing_mode !== 'subscription') return null;
  if (profile.subscription_status === 'cancelled') return 'Your plan is cancelled and ends at the end of this period, so it cannot be upgraded. Upgrade once it has ended, or contact support.';
  if (profile.subscription_status === 'past_due') return 'Your last payment failed. Update your card from Billing before upgrading.';
  return null;
};

/** "Renew pass (+30 days) · ₦9,900" — the button names what it charges. */
export const renewPassLabel = (tier: string): string => {
  const price = naira(tier);
  return price ? `Renew pass (+30 days) · ${formatPrice(price, 'NGN')}` : 'Renew pass (+30 days)';
};
