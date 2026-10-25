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

/**
 * A write's response must carry the one field the caller stores or redirects to. Anything else is an
 * envelope we do not know: throw, rather than store "undefined" as an id or return a bare object.
 */
const expectField = <T>(obj: T, field: string, method: string, path: string): T => {
  const value = (obj as any)?.[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new BachsApiError(`Bachs ${method} ${path} returned no ${field}`, 0, 'UNEXPECTED_SHAPE');
  }
  return obj;
};

/* The webhook builds its client with a short timeout: Bachs treats a reply slower than 10s as a
   failed delivery. Scheduled jobs and callables keep the default. */
export const bachsApi = (key: string, fetchImpl: typeof fetch = fetch, timeoutMs = 20_000): BachsApi => {
  if (!key) throw new BachsApiError('BACHS_SECRET_KEY is not set', 0, 'NO_KEY');
  // Refused before any header is built: a character outside this set would make the HTTP layer
  // throw with the key text in its message.
  if (!/^[A-Za-z0-9_\-]+$/.test(key)) throw new BachsApiError('BACHS_SECRET_KEY is malformed', 0, 'BAD_KEY');
  const base = bachsBaseUrl(key);
  // The key text never reaches an error: a Bachs error can echo the Authorization header back.
  const scrub = (text: string): string => text.split(key).join('[redacted]');

  const call = async (method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<any> => {
    if (method !== 'GET' && !(idempotencyKey && idempotencyKey.trim())) {
      throw new BachsApiError('missing idempotency key', 0, 'NO_IDEMPOTENCY_KEY');
    }
    const headers: Record<string, string> = { Authorization: `Bearer ${key}`, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const res = await fetchImpl(`${base}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    } as RequestInit);
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!res.ok) {
      const err = json?.error ?? json ?? {};
      /* Bachs does not always use { error: { message } } (validation errors arrive in other shapes):
         when there is no message, carry the scrubbed body so the log says WHY, not just the status. */
      const fallback = err.detail || text || '';
      const message = err.message
        ? scrub(String(err.message)).slice(0, 300)
        : scrub(`Bachs ${method} ${path} → ${res.status}${fallback ? `: ${typeof fallback === 'string' ? fallback : JSON.stringify(fallback)}` : ''}`).slice(0, 600);
      throw new BachsApiError(message, res.status, err.code ? scrub(String(err.code)) : null);
    }
    return json;
  };

  return {
    createCheckoutSession: (body, idem) =>
      call('POST', '/checkout-sessions', body, idem).then((j) => expectField(j?.data ?? j, 'checkout_url', 'POST', '/checkout-sessions')),
    getCheckoutSession: (id) => call('GET', `/checkout-sessions/${encodeURIComponent(id)}`),
    getSubscription: (id) => call('GET', `/subscriptions/${encodeURIComponent(id)}`),
    changeSubscriptionProduct: (id, productId, idem) =>
      call('PATCH', `/subscriptions/${encodeURIComponent(id)}`, { product_id: productId, proration_behavior: 'invoice_now' }, idem),
    cancelSubscriptionAtPeriodEnd: (id, idem) =>
      call('DELETE', `/subscriptions/${encodeURIComponent(id)}`, { cancel_at_period_end: true, reason: 'customer_request' }, idem),
    createPortalSession: (customerId, idem) =>
      call('POST', `/customers/${encodeURIComponent(customerId)}/portal-sessions`, undefined, idem)
        .then((j) => expectField(j?.data ?? j, 'url', 'POST', '/customers/{id}/portal-sessions')),
    listProducts: () => call('GET', '/products').then((j) => {
      if (Array.isArray(j?.items)) return j.items as unknown[];
      if (Array.isArray(j?.data)) return j.data as unknown[];
      throw new BachsApiError('Bachs GET /products returned neither an items nor a data array', 0, 'UNEXPECTED_SHAPE');
    }),
    createProduct: (body, idem) => call('POST', '/products', body, idem).then((j) => expectField(j?.data ?? j, 'id', 'POST', '/products')),
  };
};
