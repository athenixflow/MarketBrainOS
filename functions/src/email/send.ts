// Resend transport + template dispatcher. If RESEND_API_KEY is unset (e.g. before domain setup),
// sends are skipped with a warning so no user flow ever breaks. All sends are best-effort.

import { Resend } from 'resend';
import { EMAIL_TEMPLATES, EmailTemplateKey } from './templates';

const FROM = 'MarketBrain OS <no-reply@marketbrainos.app>';
const REPLY_TO = 'support@marketbrainos.app';

let _client: Resend | null = null;
const client = (): Resend | null => {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_client) _client = new Resend(key);
  return _client;
};

export const sendEmail = async (to: string, subject: string, html: string): Promise<void> => {
  if (!to || !to.includes('@')) return;
  const r = client();
  if (!r) { console.warn(`[email] RESEND_API_KEY not set — skipped "${subject}" to ${to}`); return; }
  try {
    await r.emails.send({ from: FROM, to, subject, html, replyTo: REPLY_TO });
    console.log(`[email] sent "${subject}" to ${to}`);
  } catch (e: any) {
    console.error(`[email] send failed to ${to}: ${e?.message || e}`);
  }
};

/** Render a template by key with its data and send it. Never throws. */
export const sendTemplate = async (to: string, key: EmailTemplateKey, data: any): Promise<void> => {
  try {
    const fn = EMAIL_TEMPLATES[key] as (d: any) => { subject: string; html: string };
    const { subject, html } = fn(data);
    await sendEmail(to, subject, html);
  } catch (e: any) {
    console.error(`[email] template "${key}" failed: ${e?.message || e}`);
  }
};
