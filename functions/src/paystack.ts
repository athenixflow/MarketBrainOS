import * as crypto from 'crypto';

/**
 * PAYSTACK — the payment rail (GTM parts 15, 19 §5; DO-NOW #1).
 *
 * WHY PAYSTACK AND NOT STRIPE. Stripe does not onboard Nigerian entities, and charging a
 * Nigerian card in USD either declines or routes as an international transaction at
 * 3.9–4.8% plus an FX spread — while the merchant still receives naira. Paystack does
 * naira cards, transfer and direct debit locally, international Visa/Mastercard for
 * everyone else, and subscriptions with card tokenisation, from one integration.
 *
 * WHAT LIVES IN THIS FILE, AND WHY IT IS SEPARATE. Only the parts that can be reasoned
 * about and TESTED without a Paystack account: signature verification, event parsing and
 * the plan mapping. `index.ts` imports the Admin SDK at module scope and cannot be loaded
 * by a build-time test, so a webhook verifier living there could only ever be checked by
 * eye. This is the piece where a mistake is silent and expensive, so it is the piece that
 * gets a test.
 *
 * NOT VERIFIED AGAINST THE LIVE API. Nothing here has spoken to Paystack: this project
 * has no keys yet. The signature algorithm is implemented to Paystack's documented scheme
 * (HMAC SHA-512 of the raw body with the SECRET key) and proved against known vectors in
 * `scripts/paystack.test.ts`; the event shapes are from the documentation. Written down
 * rather than implied, because "it typechecks" is not the same as "it works", and the
 * first real webhook is where the difference shows up.
 */

/** Paystack signs with the SECRET key, not the public one — and not a separate secret. */
export const PAYSTACK_SIGNATURE_HEADER = 'x-paystack-signature';

/**
 * Is this webhook really from Paystack?
 *
 * THE RAW BODY, NOT THE PARSED ONE. `JSON.stringify(req.body)` re-serialises: key order,
 * whitespace and number formatting can all differ from what was signed, and the signature
 * then fails for honest requests — or, worse, somebody "fixes" it by skipping the check.
 * The caller must pass the exact bytes received.
 *
 * TIMING-SAFE COMPARISON. A plain `===` leaks, through its own duration, how much of a
 * guessed signature was correct, which is enough to forge one a byte at a time. The
 * length check first is not a shortcut: `timingSafeEqual` throws on a length mismatch.
 */
export const verifyPaystackSignature = (
  rawBody: string | Buffer,
  signature: string | undefined,
  secretKey: string | undefined,
): boolean => {
  if (!signature || !secretKey) return false;
  const expected = crypto.createHmac('sha512', secretKey)
    .update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody)
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

/** The events this product acts on. Anything else is acknowledged and ignored. */
export type PaystackEventType =
  | 'charge.success'
  | 'subscription.create'
  | 'subscription.disable'
  | 'subscription.not_renew'
  | 'invoice.payment_failed';

export interface PaystackEvent {
  type: PaystackEventType;
  /** Kobo for NGN, cents for USD — Paystack's smallest-unit convention. */
  amountMinor: number;
  currency: string;
  /** What we passed at initialisation: who this is for, and what they bought. */
  uid: string | null;
  planCode: string | null;
  reference: string | null;
  customerEmail: string | null;
}

/**
 * Read an event into the shape this product uses, or null when it is not one we act on.
 *
 * DEFENSIVE BY DEFAULT. This runs on a payload from the public internet that has passed a
 * signature check and nothing else; a missing field is a null, never a throw, because an
 * exception here is a 500 and Paystack retries a 500 — turning one malformed event into a
 * retry storm.
 */
export const parsePaystackEvent = (body: any): PaystackEvent | null => {
  const type = String(body?.event || '');
  const known: PaystackEventType[] = [
    'charge.success', 'subscription.create', 'subscription.disable',
    'subscription.not_renew', 'invoice.payment_failed',
  ];
  if (!known.includes(type as PaystackEventType)) return null;

  const d = body?.data ?? {};
  /* `metadata` is ours: it is what we sent at initialisation, so it is the only field in
     the payload that can be trusted to say WHO this payment belongs to. Never the email
     — two accounts can share one, and a customer can change theirs at the bank. */
  const meta = d.metadata ?? {};
  return {
    type: type as PaystackEventType,
    amountMinor: Number(d.amount ?? 0),
    currency: String(d.currency ?? ''),
    uid: meta.uid ? String(meta.uid) : null,
    planCode: d.plan?.plan_code ? String(d.plan.plan_code) : (meta.plan_code ? String(meta.plan_code) : null),
    reference: d.reference ? String(d.reference) : null,
    customerEmail: d.customer?.email ? String(d.customer.email) : null,
  };
};

/**
 * Which tier a Paystack plan code grants.
 *
 * CONFIGURATION, NOT A CONSTANT (hard rule: never hardcode a price or a plan). The codes
 * are created in the Paystack dashboard and differ between test and live mode, so they
 * arrive as environment variables and an unrecognised code grants NOTHING — a typo in a
 * dashboard must fail closed, not hand somebody an Agency plan.
 */
export const tierForPlanCode = (
  planCode: string | null,
  env: Record<string, string | undefined>,
): 'pro' | 'team' | 'agency' | null => {
  if (!planCode) return null;
  const map: Array<['pro' | 'team' | 'agency', string | undefined]> = [
    ['pro', env.PAYSTACK_PLAN_PRO],
    ['team', env.PAYSTACK_PLAN_TEAM],
    ['agency', env.PAYSTACK_PLAN_AGENCY],
  ];
  for (const [tier, code] of map) {
    if (code && code === planCode) return tier;
  }
  return null;
};

/**
 * Is billing actually live?
 *
 * One switch, read everywhere, so the in-app upgrade buttons and the lifecycle emails
 * cannot disagree with reality. Absent keys means NO, whatever a flag says: a product
 * that shows a Pay button it cannot honour is worse than one that says "coming soon".
 */
export const billingLive = (env: Record<string, string | undefined>): boolean =>
  Boolean(env.PAYSTACK_SECRET_KEY) && env.PAYSTACK_BILLING_LIVE === 'true';
