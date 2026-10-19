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
/* Only scalars survive: an object, an array or a null is dropped, never stringified (String() on an
 * object can throw, and a null would otherwise read as the text "null"). */
const meta = (v: unknown): Record<string, string> =>
  v && typeof v === 'object'
    ? Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([, x]) => typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean')
          .map(([k, x]) => [k, String(x)]),
      )
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
    return ['SUCCEEDED', 'ACCEPTED', 'OVERPAID'].includes((str(d.status) ?? '').toUpperCase())
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
    status: (str(s.status) ?? '').toLowerCase(),
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
  const status = (str(c.status) ?? '').toLowerCase();
  /* A stated payment_status is authoritative: "completed" with payment_status "unpaid" or "failed"
   * is not money received. The status is only trusted when payment_status is absent. */
  const paid = c.payment_status === undefined || c.payment_status === null
    ? ['completed', 'complete', 'paid'].includes(status)
    : c.payment_status === 'paid';
  return {
    id,
    reference: str(c.reference),
    paid,
    expired: status === 'expired',
    mode: str(c.mode),
    amountMinor: toMinor(c.amount ?? c.pricing?.amount ?? c.amount_total),
    currency: upper(c.currency ?? c.pricing?.currency),
    subscriptionId: idOf(c.subscription) ?? str(c.subscription_id),
    customerId: idOf(c.customer) ?? str(c.customer_id),
  };
};
