import * as crypto from 'crypto';

/**
 * Is this webhook really from Bachs? (spec §3, §6)
 *
 * Bachs signs "{t}.{raw body}" with HMAC-SHA256 and sends `X-Bachs-Signature-V2: t=…,v1=…`,
 * with one v1 per valid secret during rotation. Three rules, each with a failure in mind:
 *
 *   RAW BYTES ONLY. A re-serialised body (JSON.stringify of the parsed request) can differ in
 *   key order or number format and fail honest requests — the usual "fix" is to skip the check.
 *   THE TIMESTAMP AS SENT. The signed string uses the header's own text for t, not a number
 *   re-printed by us.
 *   FRESHNESS. A signature more than 300s from now is refused, so a captured request cannot be
 *   replayed later. Bachs documents t in seconds; milliseconds are tolerated rather than trusted
 *   to never happen.
 */
export const BACHS_SIGNATURE_HEADER = 'x-bachs-signature-v2';
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export const parseSignatureHeader = (header: string | string[] | undefined): { t: number; tRaw: string; v1: string[] } | null => {
  const h = Array.isArray(header) ? header[0] : header;
  if (!h) return null;
  let tRaw = '';
  const v1: string[] = [];
  for (const part of h.split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === 't') tRaw = v;
    else if (k === 'v1' && /^[0-9a-f]+$/i.test(v)) v1.push(v.toLowerCase());
  }
  const t = Number(tRaw);
  if (!tRaw || !Number.isFinite(t) || v1.length === 0) return null;
  return { t, tRaw, v1 };
};

export const signPayload = (secret: string, tRaw: string, rawBody: string | Buffer): string =>
  crypto.createHmac('sha256', secret)
    .update(`${tRaw}.`)
    .update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody)
    .digest('hex');

export const verifyBachsSignature = (
  rawBody: string | Buffer,
  header: string | string[] | undefined,
  secret: string | undefined,
  nowSeconds: number = Date.now() / 1000,
): boolean => {
  if (!secret) return false;
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;
  const tSeconds = parsed.t > 1e12 ? parsed.t / 1000 : parsed.t;
  if (Math.abs(nowSeconds - tSeconds) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(signPayload(secret, parsed.tRaw, rawBody), 'utf8');
  /* Timing-safe: a plain === leaks through its duration how much of a guess was right. */
  return parsed.v1.some((sig) => {
    const b = Buffer.from(sig, 'utf8');
    return b.length === expected.length && crypto.timingSafeEqual(b, expected);
  });
};
