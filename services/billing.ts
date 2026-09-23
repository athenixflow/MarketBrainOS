import { functionsBaseUrl } from './firebase';

/**
 * IS THERE A WAY TO PAY? (GTM part 19 §5 step 3.)
 *
 * The plan's sequence ends with "`billing_live` flips the lifecycle emails and the in-app
 * upgrade buttons". This is the client half of that switch, and the reason it exists is
 * uncomfortable: until Paystack is wired, pressing Upgrade grants a paid tier and takes no
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
