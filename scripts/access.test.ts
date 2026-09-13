// Guards the tier ladder and the export gate.
//
// Why this exists: "is this a paying user" was written as `profile?.tier === 'pro'` in nine places.
// UserTier has five values and the type's own comment says higher tiers only ADD capability, yet
// that comparison is false for Team, Agency and Enterprise - so the highest-paying customers had no
// TXT/CSV/PDF export, no "Buy tokens", no "View receipts", and no low-token warning. The truth
// table below pins the ladder; the source grep at the end fails the build if the comparison returns.
//
// Runs in `npm run build`. `npm run test:access` runs it alone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tierAtLeast, isPaidTier, canExport, TIER_ORDER } from '../config/access';
import type { UserTier, UserMembership } from '../types';

let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

const profileOf = (tier?: UserTier | null): any => (tier === undefined ? undefined : tier === null ? null : { tier });
const membership = (family: UserMembership['family']): UserMembership =>
  ({ family, containerId: 'c1', role: 'viewer' } as UserMembership);

console.log('TIER LADDER:');
ok(TIER_ORDER.join(',') === 'free,pro,team,agency,enterprise', 'ladder order is free < pro < team < agency < enterprise');
for (const t of TIER_ORDER) {
  const paid = t !== 'free';
  ok(isPaidTier(t) === paid, `isPaidTier('${t}') is ${paid}`);
  ok(tierAtLeast(t, 'pro') === paid, `tierAtLeast('${t}', 'pro') is ${paid}`);
}
ok(isPaidTier(undefined) === false, 'isPaidTier(undefined) is false (unhydrated profile is not paid)');
ok(isPaidTier(null) === false, 'isPaidTier(null) is false');
ok(isPaidTier('bogus' as UserTier) === false, 'an unknown tier ranks as free');
ok(tierAtLeast('agency', 'team') && !tierAtLeast('pro', 'team'), 'tierAtLeast works above pro too');

console.log('\nEXPORT GATE:');
for (const t of TIER_ORDER) {
  ok(canExport({ profile: profileOf(t) }) === (t !== 'free'), `canExport: '${t}' with no memberships is ${t !== 'free'}`);
}
ok(canExport({ profile: profileOf('free'), memberships: [membership('workspace')] }) === true, 'canExport: Free user invited to a workspace may export the team work');
ok(canExport({ profile: profileOf('free'), memberships: [membership('agency')] }) === true, 'canExport: Free user in an agency may export');
ok(canExport({ profile: profileOf('free'), memberships: [] }) === false, 'canExport: Free user with an empty membership list may not');
ok(canExport({ profile: undefined }) === false, 'canExport: no profile (still loading) may not');
ok(canExport({ profile: null, memberships: [membership('enterprise')] }) === true, 'canExport: membership alone is enough even with a null profile');

// ---- Source guard ---------------------------------------------------------------------------------
// Fails when a profile tier is compared to 'pro' for equality anywhere a capability is decided.
// pages/Pricing.tsx iterates plan cards (its `tier` is the card, not the user) and the admin console
// reports on tiers rather than gating by them, so those trees are excluded by path.
console.log('\nSOURCE GUARD:');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
};
const files = [...walk(path.join(root, 'pages')), ...walk(path.join(root, 'components')), ...walk(path.join(root, 'services')), ...walk(path.join(root, 'context'))]
  .filter((f) => !f.includes(`${path.sep}admin${path.sep}`) && !f.endsWith('Pricing.tsx'));
const offenders: string[] = [];
const PATTERN = /\btier\s*(===|!==|==|!=)\s*'pro'/;
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);   // mixed CRLF/LF in this repo
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');   // comments may mention the old pattern
    if (PATTERN.test(code)) offenders.push(`${path.relative(root, f)}:${i + 1}: ${line.trim()}`);
  });
}
ok(files.length > 50, `scanned ${files.length} source files`);
ok(offenders.length === 0, "no `tier === 'pro'` capability checks remain (use isPaidTier / tierAtLeast / canExport)", offenders.join('\n        '));

console.log(failures === 0 ? '\nPASS — the tier ladder and export gate behave.' : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
