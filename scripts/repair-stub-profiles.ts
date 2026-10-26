/**
 * One-off repair for accounts hit by the welcome-flag race (fixed in functions/src/email/welcome.ts).
 *
 * Those signups left users/{uid} holding only welcome_sent / onboarded / last_active: no email, no
 * tier, no role, no free token allowance, no created_at. This fills in ONLY the fields that are
 * missing, from Firebase Auth (email, creation time) and the free plan defaults, and never
 * overwrites a field that is already set. A paid tier with no token fields is reported for a manual
 * look rather than guessed at. Granting the free allowance here is an admin action (billing-grants
 * rule: payment webhooks and admins only), run by the founder with their own gcloud login.
 *
 *   npx tsx scripts/repair-stub-profiles.ts           dry run: prints what it would change
 *   npx tsx scripts/repair-stub-profiles.ts --write   applies it
 *
 * Talks to the Firestore and Identity Toolkit REST APIs with `gcloud auth print-access-token`, so it
 * needs no service-account key on disk. Emails are masked in the output.
 */
import { execSync } from 'node:child_process';
import { DEFAULT_PRICING_CONFIG } from '../config/pricingConfig';

const PROJECT = 'marketbrainosweb';
const WRITE = process.argv.includes('--write');
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const token = execSync('gcloud auth print-access-token', { encoding: 'utf8', shell: true }).trim();
const H = { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT, 'Content-Type': 'application/json' };

const mask = (e?: string) => (e ? e.replace(/^(.{2}).*(@.*)$/, '$1***$2') : '(none)');
const val = (f: any) => (f ? Object.values(f)[0] : undefined);
const enc = (v: unknown) =>
  typeof v === 'number' ? { integerValue: String(v) } : { stringValue: String(v) };

async function api(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${url.split('?')[0]} -> ${res.status} ${body?.error?.message || ''}`);
  return body;
}

async function freeAllowance(): Promise<number> {
  try {
    const d = await api(`${FS}/pricing_config/global`);
    const n = Number(val(d.fields?.plans?.mapValue?.fields?.free?.mapValue?.fields?.monthlyTokens));
    if (Number.isFinite(n) && n >= 0) return n;
  } catch { /* no runtime override: use the shipped default */ }
  return DEFAULT_PRICING_CONFIG.plans.free.monthlyTokens;
}

async function allUsers() {
  const docs: any[] = [];
  let page = '';
  do {
    const r = await api(`${FS}/users?pageSize=300${page ? `&pageToken=${page}` : ''}`);
    docs.push(...(r.documents || []));
    page = r.nextPageToken || '';
  } while (page);
  return docs;
}

async function authRecords(uids: string[]) {
  const out = new Map<string, { email?: string; createdAt?: string }>();
  for (let i = 0; i < uids.length; i += 100) {
    const r = await api(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`, {
      method: 'POST', body: JSON.stringify({ localId: uids.slice(i, i + 100) }),
    });
    for (const u of r.users || []) out.set(u.localId, { email: u.email, createdAt: u.createdAt });
  }
  return out;
}

(async () => {
  const allowance = await freeAllowance();
  const users = await allUsers();
  const stubs = users.filter((d) => {
    const f = d.fields || {};
    return !f.email || !f.tier || !f.role || !f.created_at || (!f.tokens && !f.monthly_tokens && !f.purchased_tokens);
  });
  console.log(`${users.length} profiles; ${stubs.length} missing fields. Free allowance = ${allowance}. ${WRITE ? 'WRITING' : 'DRY RUN'}\n`);
  if (!stubs.length) return;

  const uidOf = (d: any) => d.name.split('/').pop() as string;
  const auth = await authRecords(stubs.map(uidOf));
  let fixed = 0, review = 0;

  for (const d of stubs) {
    const uid = uidOf(d);
    const f = d.fields || {};
    const a = auth.get(uid);
    const set: Record<string, unknown> = {};
    if (!f.email && a?.email) set.email = a.email;
    if (!f.created_at && a?.createdAt) set.created_at = new Date(Number(a.createdAt)).toISOString();
    if (!f.role) set.role = 'user';
    const tier = val(f.tier) as string | undefined;
    const noTokens = !f.tokens && !f.monthly_tokens && !f.purchased_tokens;
    if (!tier) {
      set.tier = 'free';
      if (!f.subscription_status) set.subscription_status = 'free';
      if (!f.plan_renews_at) set.plan_renews_at = new Date(Date.now() + 30 * 86400000).toISOString();
    }
    if (noTokens && (!tier || tier === 'free')) {
      set.tokens = allowance; set.monthly_tokens = allowance; set.purchased_tokens = 0;
    } else if (noTokens) {
      console.log(`  REVIEW ${uid} ${mask(a?.email)}: tier ${tier} but no token fields; not guessing`);
      review++;
    }
    if (!a) console.log(`  NOTE   ${uid}: no Firebase Auth user (deleted account?) - email/created_at left empty`);
    if (!Object.keys(set).length) continue;
    set.profile_repaired_at = new Date().toISOString();

    const shown = Object.entries(set).map(([k, v]) => `${k}=${k === 'email' ? mask(String(v)) : v}`).join(', ');
    console.log(`  ${WRITE ? 'FIX ' : 'WOULD'} ${uid} ${mask(a?.email ?? (val(f.email) as string))}: ${shown}`);
    if (WRITE) {
      const mask_ = Object.keys(set).map((k) => `updateMask.fieldPaths=${k}`).join('&');
      await api(`${FS}/users/${uid}?${mask_}&currentDocument.exists=true`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: Object.fromEntries(Object.entries(set).map(([k, v]) => [k, enc(v)])) }),
      });
    }
    fixed++;
  }
  console.log(`\n${WRITE ? 'Repaired' : 'Would repair'} ${fixed} profile(s); ${review} need a manual look.`);
  if (!WRITE) console.log('Run again with --write to apply.');
})().catch((e) => { console.error(String(e?.message || e)); process.exit(1); });
