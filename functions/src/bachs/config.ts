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
