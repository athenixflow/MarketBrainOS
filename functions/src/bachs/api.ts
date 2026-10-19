/**
 * Thin Bachs REST v1 client (spec §3). Plain fetch rather than @bachs/sdk: the SDK was published
 * the day before the design and has no subscription PATCH or refunds. Every write carries an
 * Idempotency-Key, so a retried call cannot create a second checkout or a second cancel.
 *
 * THE KEY DECIDES THE ENVIRONMENT. sk_live_ talks to production, anything else to the sandbox —
 * there is no separate setting that could point a sandbox key at live, or the reverse.
 */
export class BachsApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null) {
    super(message);
    this.name = 'BachsApiError';
  }
}

export const bachsBaseUrl = (key: string): string =>
  key.startsWith('sk_live_') ? 'https://api.bachs.io/v1' : 'https://sandbox-api.bachs.io/v1';

export interface BachsApi {
  createCheckoutSession(body: Record<string, unknown>, idempotencyKey: string): Promise<{ checkout_id: string; checkout_url: string }>;
  getCheckoutSession(id: string): Promise<unknown>;
  getSubscription(id: string): Promise<unknown>;
  changeSubscriptionProduct(id: string, productId: string, idempotencyKey: string): Promise<unknown>;
  cancelSubscriptionAtPeriodEnd(id: string, idempotencyKey: string): Promise<unknown>;
  createPortalSession(customerId: string, idempotencyKey: string): Promise<{ url: string }>;
  listProducts(): Promise<unknown[]>;
  createProduct(body: Record<string, unknown>, idempotencyKey: string): Promise<{ id: string }>;
}

export const bachsApi = (key: string, fetchImpl: typeof fetch = fetch): BachsApi => {
  if (!key) throw new BachsApiError('BACHS_SECRET_KEY is not set', 0, 'NO_KEY');
  const base = bachsBaseUrl(key);

  const call = async (method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<any> => {
    const headers: Record<string, string> = { Authorization: `Bearer ${key}`, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const res = await fetchImpl(`${base}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    } as RequestInit);
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!res.ok) {
      const err = json?.error ?? json ?? {};
      throw new BachsApiError(String(err.message || `Bachs ${method} ${path} → ${res.status}`), res.status, err.code ? String(err.code) : null);
    }
    return json;
  };

  return {
    createCheckoutSession: (body, idem) => call('POST', '/checkout-sessions', body, idem).then((j) => j?.data ?? j),
    getCheckoutSession: (id) => call('GET', `/checkout-sessions/${encodeURIComponent(id)}`),
    getSubscription: (id) => call('GET', `/subscriptions/${encodeURIComponent(id)}`),
    changeSubscriptionProduct: (id, productId, idem) =>
      call('PATCH', `/subscriptions/${encodeURIComponent(id)}`, { product_id: productId, proration_behavior: 'invoice_now' }, idem),
    cancelSubscriptionAtPeriodEnd: (id, idem) =>
      call('DELETE', `/subscriptions/${encodeURIComponent(id)}`, { cancel_at_period_end: true, reason: 'customer_request' }, idem),
    createPortalSession: (customerId, idem) =>
      call('POST', `/customers/${encodeURIComponent(customerId)}/portal-sessions`, undefined, idem).then((j) => j?.data ?? j),
    listProducts: () => call('GET', '/products').then((j) => {
      if (Array.isArray(j?.items)) return j.items as unknown[];
      if (Array.isArray(j?.data)) return j.data as unknown[];
      throw new BachsApiError('Bachs GET /products returned neither an items nor a data array', 0, 'UNEXPECTED_SHAPE');
    }),
    createProduct: (body, idem) => call('POST', '/products', body, idem).then((j) => j?.data ?? j),
  };
};
