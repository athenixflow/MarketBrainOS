// Resend transport + template dispatcher. If RESEND_API_KEY is unset (e.g. before domain setup),
// sends are skipped with a warning so no user flow ever breaks. All sends are best-effort.

import { Resend } from 'resend';
import { EMAIL_TEMPLATES, EmailTemplateKey, MARKETING_KEYS } from './templates';
import { unsubUrl } from './unsubscribe';

const FROM = 'MarketBrain OS <no-reply@marketbrainos.app>';
const REPLY_TO = 'support@marketbrainos.app';

let _client: Resend | null = null;
const client = (): Resend | null => {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_client) _client = new Resend(key);
  return _client;
};

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  headers?: Record<string, string>,
): Promise<void> => {
  if (!to || !to.includes('@')) return;
  const r = client();
  if (!r) { console.warn(`[email] RESEND_API_KEY not set — skipped "${subject}" to ${to}`); return; }
  try {
    // Resend returns { data, error } and does NOT throw on API errors — check the error field.
    const { error } = await r.emails.send({ from: FROM, to, subject, html, replyTo: REPLY_TO, headers });
    if (error) { console.error(`[email] resend rejected "${subject}" to ${to}: ${(error as any)?.message || JSON.stringify(error)}`); return; }
    console.log(`[email] sent "${subject}" to ${to}`);
  } catch (e: any) {
    console.error(`[email] send failed to ${to}: ${e?.message || e}`);
  }
};

/**
 * Render a template by key with its data and send it. Never throws.
 *
 * `uid` is what makes an email unsubscribable. Marketing mail — the onboarding sequence,
 * the activation nudges, anything somebody did not ask for individually — carries
 * `List-Unsubscribe` and the one-click POST header; a receipt, a password reset or an
 * invitation does not, because those are answers to something the person just did and an
 * unsubscribe link on them only teaches people that unsubscribing stops their receipts.
 *
 * A MARKETING SEND WITHOUT A USABLE LINK DOES NOT GO OUT. Refusing is the safe failure:
 * the alternative is bulk mail with no unsubscribe, which is the one mistake that costs
 * the sending domain its reputation and takes the transactional mail down with it.
 */
export const sendTemplate = async (
  to: string,
  key: EmailTemplateKey,
  data: any,
  uid?: string,
): Promise<void> => {
  try {
    const marketing = MARKETING_KEYS.has(key);
    const url = marketing ? unsubUrl(String(uid || '')) : '';
    if (marketing && !url) {
      console.error(`[email] refused marketing send "${key}" to ${to}: no unsubscribe link (uid or secret missing)`);
      return;
    }
    const fn = EMAIL_TEMPLATES[key] as (d: any) => { subject: string; html: string };
    const { subject, html } = fn({ ...data, unsubUrl: url });
    await sendEmail(to, subject, html, url ? {
      'List-Unsubscribe': `<${url}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    } : undefined);
  } catch (e: any) {
    console.error(`[email] template "${key}" failed: ${e?.message || e}`);
  }
};
