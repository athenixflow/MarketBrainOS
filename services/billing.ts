import { httpsCallable } from 'firebase/functions';
import { functions, functionsBaseUrl } from './firebase';
import type { Currency } from './planActions';

/**
 * IS THERE A WAY TO PAY? (GTM part 19 §5 step 3.)
 *
 * The plan's sequence ends with "`billing_live` flips the lifecycle emails and the in-app
 * upgrade buttons". This is the client half of that switch, and the reason it exists is
 * uncomfortable: until payments are wired, pressing Upgrade grants a paid tier and takes no
 * money. So the button promises a charge that never happens AND hands out the plan — two
 * false statements at once, in the one place a customer is most attentive.
 *
 * THE SERVER IS THE AUTHORITY. `billingStatus` answers from the environment — keys present
 * AND the flag set — so no client can decide it is live, and a deployment without keys
 * cannot be talked into showing a Pay button.
 *
 * IT FAILS CLOSED. A network error, a cold start, an ad-blocker: all answer "not live".
 * Being wrong in that direction hides a working Pay button for a moment; being wrong the
 * other way shows a Pay button that cannot charge, which is the failure this prevents.
 */
export interface BillingStatus {
  billing_live: boolean;
  provider: string;
}

let cached: BillingStatus | null = null;

export const fetchBillingStatus = async (): Promise<BillingStatus> => {
  if (cached) return cached;
  try {
    const res = await fetch(`${functionsBaseUrl}/billingStatus`);
    if (!res.ok) return { billing_live: false, provider: 'none' };
    const data = await res.json() as Partial<BillingStatus>;
    cached = { billing_live: data.billing_live === true, provider: String(data.provider || 'none') };
    return cached;
  } catch {
    return { billing_live: false, provider: 'none' };
  }
};

/* The pure rules (and formatPrice) live in services/planActions.ts so the build-time tests can load them. */
export type { Currency } from './planActions';
export { formatPrice } from './planActions';

/** ₦ for visitors whose browser says Nigeria; anyone can switch (spec §2). */
export const defaultCurrency = (): Currency => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const langs = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [];
    return tz === 'Africa/Lagos' || langs.some((l) => /-NG$/i.test(l)) ? 'NGN' : 'USD';
  } catch { return 'USD'; }
};

/** The currency the account itself pays in (`billing_currency`, stamped by its last paid grant), if it has one. */
export const accountCurrency = (v: unknown): Currency | null => (v === 'USD' || v === 'NGN' ? v : null);

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
