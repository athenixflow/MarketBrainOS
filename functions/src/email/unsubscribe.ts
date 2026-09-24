/**
 * ONE-CLICK UNSUBSCRIBE (GTM part 12 §3, §4.5 step 2 — "nothing else ships without it").
 *
 * Not a nicety and not only a legal box. Gmail and Yahoo's bulk-sender rules require a
 * `List-Unsubscribe` header and a one-click POST endpoint (RFC 8058) on marketing mail;
 * without them an onboarding sequence earns spam complaints instead of unsubscribes, and
 * a complaint rate is a domain-level problem that follows the transactional mail — the
 * receipts and password resets — into the spam folder with it.
 *
 * This module is the link and its token only. The endpoint lives in `index.ts`, with the
 * other HTTP functions.
 *
 * THE TOKEN IS AN HMAC OF THE UID, not the uid alone. A bare `?u=<uid>` link is a working
 * unsubscribe button for anybody who can guess a uid — and uids appear in share ids,
 * support threads and screenshots. The secret is `UNSUB_SECRET` where one is set, and the
 * Resend key otherwise: it is present wherever mail is sent, never leaves the server, and
 * an HMAC reveals nothing about its key. If neither exists no mail can be sent at all, so
 * an unsubscribable email without a working link is not a state that can occur.
 */

import crypto from 'node:crypto';
import { SITE_URL } from './layout';

const secret = (): string => process.env.UNSUB_SECRET || process.env.RESEND_API_KEY || '';

/** Empty when no secret is configured, which callers must treat as "cannot send". */
export const unsubToken = (uid: string): string => {
  const key = secret();
  if (!key || !uid) return '';
  return crypto.createHmac('sha256', key).update(`unsub:${uid}`).digest('base64url').slice(0, 32);
};

export const unsubUrl = (uid: string): string => {
  const t = unsubToken(uid);
  return t ? `${SITE_URL}/e/unsubscribe?u=${encodeURIComponent(uid)}&t=${t}` : '';
};

/** Constant-time, because a token check that leaks its comparison leaks the token. */
export const verifyUnsubToken = (uid: string, token: string): boolean => {
  const expected = unsubToken(uid);
  if (!expected || !token || token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
};
