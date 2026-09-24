// Guards App Check (GTM DO-NOW #9) — and the deliberate decision about where it does NOT go.
//
// Two failures are possible here and they point in opposite directions.
//
// TOO LITTLE: `executeAnalysis` is a plain HTTP function, so nothing attaches or verifies an
// attestation token for it automatically the way it would for a callable. Miss either half
// and App Check is switched on in the console, reported as active, and enforcing nothing —
// the worst state, because it looks done.
//
// TOO MUCH: the public scorer answers any origin on purpose. That CORS header is what lets a
// score be embedded in somebody else's page, which is the badge loop. Attestation there would
// restrict the scorer to our own domain and quietly kill the loop, to stop abuse that the IP
// cap, the daily ceiling, the 24-hour cache and the kill switch already bound. The playbook
// asks for both in different parts and never reconciles them; this file is the reconciliation,
// so a later "we should App Check everything" has to argue with a failing test rather than a
// comment somebody can delete.
//
// Runs in `npm run build`. `npm run test:appcheck` runs it alone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/* Comments blanked before every source match: a file's own prose about attestation must
   never be what satisfies a check about attestation. */
const blank = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

const server = blank(read('functions/src/index.ts'));
const client = blank(read('services/appCheck.ts'));
const gemini = blank(read('services/geminiService.ts'));
const vite = blank(read('vite.config.ts'));

/* ============================== 1. both halves, or neither counts */

console.log('THE AUTHENTICATED PATH:');

const analysis = server.slice(
  server.indexOf('export const executeAnalysis'),
  server.indexOf('export const publicPageScore'),
);
ok(analysis.length > 0, 'executeAnalysis was located');
ok(/await verifyAppCheck\(req\)/.test(analysis), 'the server verifies the attestation header');
ok(/admin\.appCheck\(\)\.verifyToken\(token\)/.test(server),
  'it verifies through the Admin SDK, not by inspecting the token itself');
ok(/'X-Firebase-AppCheck'/.test(client), 'the client builds the header');
ok(/\.\.\.attestation,/.test(gemini) && /appCheckHeader\(\)/.test(gemini),
  'and the analysis request actually sends it');
/* The ID token is a separate thing and must not be replaced by this one. */
ok(/Authorization.*Bearer \$\{token\}/.test(gemini),
  'the ID token still goes with it — who they are and where from are different questions');

/* ============================ 2. monitoring mode, deliberately */

console.log('\nMONITORING MODE:');

ok(/APP_CHECK_ENFORCED = \(\): boolean => process\.env\.APP_CHECK_ENFORCED === 'true'/.test(server),
  'enforcement is a flag, off unless explicitly set to true');
ok(/if \(APP_CHECK_ENFORCED\(\)\) \{/.test(analysis),
  'a failed attestation only refuses the request when enforcement is on');
/*
 * The refusal has to sit INSIDE that branch. Outside it, the flag is decoration and the
 * first deploy locks out every browser reCAPTCHA happens to score badly.
 */
const enforcedBranch = analysis.slice(analysis.indexOf('if (APP_CHECK_ENFORCED())'), analysis.indexOf('if (APP_CHECK_ENFORCED())') + 260);
ok(/res\.status\(401\)/.test(enforcedBranch),
  'the 401 is inside the enforcement branch, not beside it');
/* ANCHORED ON THE CATCH. The first cut matched any `return {};` — and there is one at
   the top of the function for the not-configured case — so turning the catch into a
   rethrow passed clean. A control proved it. */
ok(/catch \{\s*return \{\};\s*\}/.test(client),
  'the catch returns no header rather than throwing when a token cannot be fetched');

/* ===================== 3. where it deliberately does NOT go */

console.log('\nTHE PUBLIC SCORER:');

const scorer = server.slice(
  server.indexOf('export const publicPageScore'),
  server.indexOf('export const createShareLink'),
);
ok(scorer.length > 0, 'publicPageScore was located');
ok(!/verifyAppCheck/.test(scorer),
  'the scorer does NOT require attestation — see the header of this file',
  'adding it restricts the scorer to our own domain and kills the embed');
ok(/Access-Control-Allow-Origin', '\*'/.test(scorer),
  'it still answers any origin, which is what makes a score embeddable');
/* And the limits that stand in for attestation are all still there. */
ok(/underLimit\('public_score_ip'/.test(scorer), 'the per-IP daily cap is in place');
ok(/public_score_day_/.test(scorer), 'the global daily ceiling is in place');
ok(/cfg\.enabled === false/.test(scorer), 'the kill switch is in place');

/* ============================ 4. the key itself */

console.log('\nTHE SITE KEY:');

ok(/'process\.env\.RECAPTCHA_SITE_KEY'/.test(vite),
  'the site key is exposed to the bundle through the define block');
/*
 * A SITE KEY IS PUBLIC; A SECRET KEY IS NOT. reCAPTCHA Enterprise issues both, they look
 * nothing alike, and pasting the wrong one into a define block publishes it to every
 * visitor. The default here must stay empty so a missing key means "App Check off",
 * never "App Check with whatever was committed last".
 */
ok(/RECAPTCHA_SITE_KEY \|\| ""\)/.test(vite),
  'its default is empty — no key is committed to the repo');
ok(!/RECAPTCHA_SECRET|recaptcha_secret/i.test(vite + client),
  'no secret-key name appears anywhere near the client bundle');
ok(/if \(started \|\| !SITE_KEY/.test(client),
  'no key configured means App Check never starts, rather than starting broken');
ok(/import\.meta\.env\.DEV/.test(client),
  'the debug provider is confined to dev builds, so localhost and the harness still work');

console.log(failures === 0
  ? '\nPASS — the authenticated path is attested and fails open; the public scorer is deliberately not.'
  : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
