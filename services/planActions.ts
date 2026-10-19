import { DEFAULT_PRICING_CONFIG, Tier } from '../config/pricingConfig';

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

/** "Renew pass (+30 days) · ₦9,900" — the button names what it charges. */
export const renewPassLabel = (tier: string): string => {
  const price = naira(tier);
  return price ? `Renew pass (+30 days) · ${formatPrice(price, 'NGN')}` : 'Renew pass (+30 days)';
};
