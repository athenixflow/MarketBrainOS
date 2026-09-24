/**
 * RESEND WEBHOOK VERIFICATION (GTM part 12 §4.2 item 6).
 *
 * Resend's webhooks are Svix-signed: three headers (`svix-id`, `svix-timestamp`,
 * `svix-signature`) over the RAW request body. The SDK already in `package.json` verifies
 * them, which is better than hand-rolling the HMAC — the signature covers
 * `${id}.${timestamp}.${body}` in that exact shape, and the timestamp window that stops a
 * captured request being replayed a week later comes with it.
 *
 * THE RAW BYTES, NEVER A RE-SERIALISED OBJECT. `JSON.stringify(req.body)` reorders keys and
 * changes whitespace, so it produces a different digest for an honest request and the
 * endpoint rejects everything. This is the same trap the Paystack webhook documents, for
 * the same reason.
 *
 * Kept in its own module so the guard can import and exercise the shipped function rather
 * than a copy of it — `index.ts` loads the Admin SDK at module scope and cannot be imported
 * from a test.
 */

import crypto from 'node:crypto';

export interface ResendEvent {
  type: string;
  data: {
    email_id?: string;
    message_id?: string;
    to?: string[];
    subject?: string;
    created_at?: string;
    tags?: Record<string, string>;
    bounce?: { type?: string; subType?: string; message?: string };
    [k: string]: unknown;
  };
}

/** True when the endpoint is configured at all. Without it nothing can be verified. */
export const webhookConfigured = (): boolean => Boolean(process.env.RESEND_WEBHOOK_SECRET);

/** Svix allows five minutes of clock skew; a correctly signed request older than that is
    a captured one being replayed. */
const TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Verify and parse. Returns null on ANY failure — a bad signature, a missing header, a
 * malformed body, a stale timestamp — because the caller's only correct response to all of
 * them is the same 401, and distinguishing them in the reply tells an attacker which part
 * they got wrong.
 *
 * NODE CRYPTO, NOT THE SDK, AND THE REASON IS STRUCTURAL. `scripts/lifecycle.test.ts`
 * imports this module so it can exercise the SHIPPED verifier rather than a copy of it,
 * and the site build runs from the ROOT package, where `functions/node_modules` does not
 * exist. Importing `resend` here therefore passed locally and broke the production build —
 * every other module that `scripts/` reaches into (`escape.ts`, `paystack.ts`) is
 * dependency-free for exactly this reason, and this one now is too.
 *
 * The scheme is Svix's, which Resend uses: HMAC-SHA256 over `id.timestamp.body`, base64,
 * against the secret's decoded bytes. The header carries a space-separated list of
 * versioned signatures because a secret can be rotated with both live at once, so EVERY
 * v1 entry is checked and any match is a pass.
 */
export const verifyResendWebhook = (
  rawBody: string,
  headers: Record<string, unknown>,
): ResendEvent | null => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret || !rawBody) return null;

  const id = String(headers['svix-id'] || '');
  const timestamp = String(headers['svix-timestamp'] || '');
  const signature = String(headers['svix-signature'] || '');
  if (!id || !timestamp || !signature) return null;

  /* The timestamp is signed, but it still has to be checked: a replay carries a perfectly
     valid signature over a perfectly valid old timestamp. */
  const sentAt = Number(timestamp) * 1000;
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > TOLERANCE_MS) return null;

  try {
    const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    if (key.length === 0) return null;
    const expected = crypto.createHmac('sha256', key)
      .update(`${id}.${timestamp}.${rawBody}`)
      .digest();

    const offered = signature.split(' ')
      .filter((part) => part.startsWith('v1,'))
      .map((part) => Buffer.from(part.slice(3), 'base64'));

    /* Constant-time, and length-checked first because timingSafeEqual throws on a mismatch
       rather than returning false. */
    const matches = offered.some((sig) =>
      sig.length === expected.length && crypto.timingSafeEqual(sig, expected));
    if (!matches) return null;

    return JSON.parse(rawBody) as ResendEvent;
  } catch {
    return null;
  }
};

/**
 * Which field an event stamps on the log row.
 *
 * A MAP, NOT A SWITCH WITH A DEFAULT. An unknown event type must land nowhere rather than
 * in whichever branch happened to be last: Resend adds event types, and a new one silently
 * recorded as a delivery would inflate the only number these rows exist to produce.
 */
export const EVENT_FIELD: Record<string, string> = {
  'email.sent': 'sent_at',
  'email.delivered': 'delivered_at',
  'email.opened': 'opened_at',
  'email.clicked': 'clicked_at',
  'email.bounced': 'bounced_at',
  'email.complained': 'complained_at',
  'email.failed': 'failed_at',
  'email.delivery_delayed': 'delayed_at',
  'email.suppressed': 'suppressed_at',
};

/**
 * What an event means for whether we may keep writing to this address.
 *
 * `null` means "changes nothing". A soft bounce is a full mailbox or a temporary refusal
 * and recovers; a hard bounce and a complaint do not, and both must stop future marketing
 * mail — a complaint especially, because continuing to send to somebody who pressed the
 * spam button is exactly what costs a sending domain its reputation.
 */
export const emailStatusFor = (event: ResendEvent): 'bounced' | 'soft_bounce' | 'complained' | null => {
  if (event.type === 'email.complained') return 'complained';
  if (event.type === 'email.bounced') {
    const kind = String(event.data?.bounce?.type || '').toLowerCase();
    return kind === 'transient' || kind === 'soft' ? 'soft_bounce' : 'bounced';
  }
  return null;
};
