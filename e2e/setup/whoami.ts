/**
 * Prints a test account's OWN users/{uid} document, read with that account's own session (the same
 * read the app makes). Diagnostic only: shows which profile fields exist, values for the economy ones.
 *   npx tsx e2e/setup/whoami.ts free
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const role = process.argv[2] || 'free';
const here = path.dirname(fileURLToPath(import.meta.url));
const state = JSON.parse(readFileSync(path.join(here, '..', '.auth', `${role}.json`), 'utf8'));
// Playwright serialises IndexedDB values in its own encoded form ({k, v} pairs), so match the pairs.
const idb = JSON.stringify(state.origins.flatMap((o: any) => o.indexedDB || []).filter((d: any) => d.name === 'firebaseLocalStorageDb'));
const uid = /"k":"uid","v":"([^"]+)"/.exec(idb)?.[1];
const token = /"k":"accessToken","v":"([^"]+)"/.exec(idb)?.[1];
if (!uid || !token) throw new Error('no Firebase session in the saved state');

const url = `https://firestore.googleapis.com/v1/projects/marketbrainosweb/databases/(default)/documents/users/${uid}`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const body: any = await res.json();
if (!res.ok) { console.log(res.status, body?.error?.message); process.exit(1); }
const f = body.fields || {};
const show = ['is_suspended', 'risk_score', 'block_reason', 'email', 'tier', 'role', 'tokens', 'monthly_tokens', 'purchased_tokens', 'created_at', 'onboarded', 'welcome_sent'];
console.log(`${role}: fields present = ${Object.keys(f).sort().join(', ')}`);
for (const k of show) {
  const v = f[k];
  const val = v ? Object.values(v)[0] : '(missing)';
  console.log(`  ${k}: ${k === 'email' && v ? '(set)' : val}`);
}
