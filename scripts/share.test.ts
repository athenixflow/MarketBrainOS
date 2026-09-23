// Guards the share page (GTM part 03 §5, DO-NEXT #11).
//
// THIS IS THE ONLY PLACE IN THE PRODUCT THAT TURNS UNTRUSTED TEXT INTO HTML.
//
// Everywhere else, model output reaches a screen through React, which escapes by
// construction. The share page is server-rendered HTML built by string concatenation, and
// what it renders is a report ABOUT SOMEBODY ELSE'S WEB PAGE — headlines, CTA copy and
// quoted fragments the model lifted verbatim from a site the sharer does not control. A
// page can therefore put text of its choosing in front of this renderer, and a missed
// escape is stored XSS on our own domain, served to whoever opens a shared link.
//
// The fetched-page path already treats that content as untrusted for the MODEL (the
// <<<PAGE fences); this is the same content treated as untrusted for the BROWSER.
//
// Runs in `npm run build`. `npm run test:share` runs it alone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from '../functions/src/escape';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'functions', 'src', 'index.ts'), 'utf8');

let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

/* ======================================== 1. the escaper, exercised */

console.log('ESCAPING:');

/*
 * THE SHIPPED FUNCTION, IMPORTED. It lives in its own module precisely so this test can
 * exercise it: `index.ts` loads the Admin SDK at module scope and cannot be imported
 * here, a reimplementation would pass while the real one was wrong, and reading the
 * source to eval it would be fragile and a bad habit to leave lying around.
 */
const esc = escapeHtml;

const ATTACKS: Array<[string, string]> = [
  ['<script>alert(1)</script>', 'script tag'],
  ['" onmouseover="alert(1)', 'attribute break-out with a double quote'],
  ["' onfocus='alert(1)", 'attribute break-out with a single quote'],
  ['</title><script>alert(1)</script>', 'closing the title element early'],
  ['<img src=x onerror=alert(1)>', 'event handler on an image'],
  ['javascript:alert(1)', 'a javascript URL'],
  ['</style><script>alert(1)</script>', 'closing the style element early'],
];

for (const [payload, name] of ATTACKS) {
  const out = esc(payload);
  ok(!/<[a-zA-Z/]/.test(out), `${name}: no tag survives`, out.slice(0, 60));
  ok(!out.includes('"') && !out.includes("'"), `${name}: no raw quote survives`, out.slice(0, 60));
}

/* The escaper must handle what a missing field actually is, not just strings. */
ok(esc(undefined) === '' && esc(null) === '', 'a missing value escapes to nothing, never "undefined"');
ok(esc(87) === '87', 'a number survives intact');

/* ============================= 2. every interpolation goes through it */

console.log('\nINTERPOLATIONS:');

/*
 * BOUNDED TO THE RENDERER, and the bounds matter: the first cut ran from `shell` to the
 * end of the file and swept in the growth rollup's console.log, reporting `dau` and
 * `dayKey` as unescaped HTML. A check that cries wolf on a log line is a check somebody
 * deletes.
 */
const between = (from: string, to: string): string => {
  const a = server.indexOf(from);
  const b = server.indexOf(to, a + 1);
  return a < 0 || b < 0 ? '' : server.slice(a, b);
};
const renderBlock = between('export const sharePage', 'const MODULE_LABELS');
const shellBlock = between('const shell = (d:', '</html>`;');
const shareBlock = renderBlock + shellBlock;
ok(renderBlock.length > 0 && shellBlock.length > 0, 'the renderer and its shell were located');

/*
 * EVERY `${...}` THAT BECOMES HTML IS ESCAPED, OR IS HTML WE BUILT.
 *
 * SCANNED LINE BY LINE, and that detail is the whole reliability of this check. The first
 * cut paired backticks to find template literals — which NESTED TEMPLATES break: the
 * findings list is `...map(it => `<li>${esc(it)}</li>`)...`, so the inner template sits
 * between the outer pair's closing and the next opening backtick and was never scanned at
 * all. Its own negative control proved it: unescaping the per-item render — the single
 * most likely injection point on the page — was MISSED. Any line containing a `<` is
 * treated as emitting markup, which needs no pairing and cannot skip a nested region.
 *
 * Lines that merely BUILD a value (`const title = ...`) carry no `<` and are excluded
 * naturally; those values are escaped by the shell, asserted separately below.
 */
const markupLines = shareBlock.split('\n').filter((l) => l.includes('<') && l.includes('${'));
ok(markupLines.length > 0, 'found the lines that emit markup');

/*
 * An expression is safe when it CONTAINS an `esc(` call — the nested `.map(it => esc(it))`
 * is one expression and reading it as unescaped because it does not START with `esc(`
 * would be a false alarm — or when it is one of three named values this file assembled
 * from already-escaped pieces.
 */
const SAFE = /esc\(|^(SHARE_SITE|sections|d\.body)$/;
const interpolations = markupLines
  .flatMap((l) => [...l.matchAll(/\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)].map((m) => m[1]!.trim()))
  .filter(Boolean);
const unescaped = interpolations.filter((expr) => !SAFE.test(expr));
ok(unescaped.length === 0,
  `all ${interpolations.length} interpolations that become HTML are escaped or ours`,
  unescaped.join(' | '));

/* And the shell escapes the two fields the renderer hands it unescaped, which is the
   other half of that argument — miss this and the title is an injection point. */
ok(/<title>\$\{esc\(d\.title\)\}<\/title>/.test(shellBlock),
  'the shell escapes the page title');
ok(/content="\$\{esc\(d\.description\)\}"/.test(shellBlock),
  'the shell escapes the meta description');

/* ============================== 3. the page's own promises */

console.log('\nTHE PAGE ITSELF:');

ok(/name="robots" content="noindex/.test(shareBlock),
  'a shared report is noindex — somebody\'s client work is not ours to put in an index');
ok(/Anyone with this link can read this page/.test(server),
  'the page says plainly that the link is public');
ok(/revoked === true/.test(server),
  'a revoked link stops rendering the report');
ok(/\^\[A-Za-z0-9_-\]\{6,40\}\$/.test(server),
  'the id is validated before it reaches Firestore');

/* ============================ 4. ownership, on the server */

console.log('\nOWNERSHIP:');

const createBlock = server.slice(
  server.indexOf('export const createShareLink'),
  server.indexOf('export const revokeShareLink'),
);
ok(/row\.creator_user_id !== uid && row\.user_id !== uid/.test(createBlock),
  'sharing checks ownership against the stored analysis, not the request');
ok(/not-found/.test(createBlock) && !/permission-denied/.test(createBlock),
  'a stranger gets "no such analysis", never a 403 that confirms it exists');
ok(/underLimit\('share_create'/.test(createBlock),
  'share creation is rate limited');

const revokeBlock = server.slice(
  server.indexOf('export const revokeShareLink'),
  server.indexOf('export const sharePage'),
);
ok(/owner_uid !== uid/.test(revokeBlock), 'only the owner can revoke a link');

/* The collection is server-only: a client that could write it could publish anything. */
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const shareRule = rules.slice(rules.indexOf('match /shared_results/'), rules.indexOf('match /shared_results/') + 200);
ok(/allow read, write: if false;/.test(shareRule),
  'no client may read or write shared_results directly');

/* ================================ 5. the link is reachable */

console.log('\nROUTING:');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const shareRoute = (vercel.rewrites ?? []).find((r: any) => String(r.source).startsWith('/s/'));
ok(shareRoute != null, 'vercel.json proxies /s/:id');
ok(shareRoute != null && /sharePage/.test(shareRoute.destination),
  'it proxies to the share renderer');
/*
 * ORDER MATTERS. The app-shell rewrites are a long alternation, and a `/s/` route placed
 * after a catch-all would be swallowed by it — the link would open the SPA, which knows
 * nothing about share ids, and every shared link in the wild would show an empty app.
 */
ok((vercel.rewrites ?? []).indexOf(shareRoute) === 0,
  'the share route is matched before the app-shell rewrites');

console.log(failures === 0
  ? '\nPASS — a shared report escapes, says it is public, and only its owner controls it.'
  : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
