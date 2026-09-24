// Guards the route allowlist in vercel.json.
//
// vercel.json no longer rewrites EVERY path to index.html. That catch-all meant any typo returned 200
// with the app shell, which Google treats as a soft-404. It is now an explicit allowlist, and anything
// outside it falls through to dist/404.html with a real 404 status.
//
// The allowlist is the hazard: add a tool slug or a page and forget vercel.json, and that page starts
// returning 404 to users and crawlers with nothing to catch it. This test reads the routes the app
// actually declares and fails the build if any of them would 404.
//
//   node scripts/routes.test.mjs
//
// Wired into `npm run build`, so drift breaks the build instead of the site.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

// --- 1. What the app declares -------------------------------------------------------------------
const app = read('App.tsx');
const staticRoutes = [...app.matchAll(/<Route\s+path="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((r) => r !== '*'); // the catch-all NotFound is the thing we WANT to 404

const tools = read('config/toolConfigs.ts');
const toolRoutes = [...tools.matchAll(/slug:\s*'([a-z0-9-]+)'/g)].map((m) => `/${m[1]}`);

// Prerendered routes are written as real files, and Vercel serves the filesystem before rewrites,
// so they are reachable whether or not a rewrite covers them.
const prerender = read('scripts/prerender.ts');
const docsRoutes = [...prerender.matchAll(/'(\/documentation[^']*)'/g)].map((m) => m[1]);
// Quoted literals, not a comma split. A comment placed inside that array put its own
// prose into the list and dropped a real route out of it, so a page that IS prerendered
// was reported as a production 404 — a failure that sends somebody hunting in vercel.json
// for a rewrite that was never the problem.
const marketingBlock = (prerender.match(/const MARKETING = \[([^\]]+)\]/) || [, ''])[1];
const marketing = [...marketingBlock.matchAll(/'(\/[^']*)'/g)].map((m) => m[1]);

const declared = [...new Set([...staticRoutes, ...toolRoutes])];

// --- 2. What vercel.json will actually serve -----------------------------------------------------
const vercel = JSON.parse(read('vercel.json'));
const rewrites = (vercel.rewrites || []).map((r) => {
  // The sources here are plain regex-style groups; anchor them and test whole paths.
  try { return new RegExp(`^${r.source}$`); } catch { return null; }
}).filter(Boolean);

const staticallyServed = new Set([...marketing, ...docsRoutes, '/']);

const reachable = (route) => {
  // A wildcard route like /admin/* is declared by React Router; test its base path.
  const probe = route.replace(/\/\*$/, '').replace(/\/:[^/]+/g, '/x') || '/';
  if (staticallyServed.has(probe)) return true;
  return rewrites.some((re) => re.test(probe));
};

// --- 3. The shell the rewrites land on ----------------------------------------------------------
// Rewrites must target app.html (the clean Vite shell that prerender.ts emits), never index.html.
// index.html is the prerendered HOMEPAGE: routing app pages to it painted the marketing landing
// page, then blank, then the app on every deep link. This runs before `vite build`, so it checks
// the producer rather than the artifact.
/*
 * A LOCAL rewrite must land on app.html. An ABSOLUTE one is a proxy and is a different
 * thing: `/s/:id` is served by the `sharePage` Cloud Function, because a link pasted into
 * WhatsApp is fetched by a crawler that runs no JavaScript and the SPA shell would give it
 * a blank page with the site's generic preview. The original rule — "every rewrite goes to
 * app.html" — would have blocked that; narrowing it by DESTINATION KIND keeps the bug it
 * was written for (an app route sent to index.html, which painted the marketing page then
 * blanked on every deep link) exactly as catchable.
 */
const isProxy = (r) => /^https:\/\//.test(String(r.destination));
const badDestinations = (vercel.rewrites || [])
  .filter((r) => !isProxy(r) && r.destination !== '/app.html');

/* A proxy may only point at our own functions: a rewrite is invisible to the visitor, so
   one aimed anywhere else would serve a third party's content from our domain and our
   cookies' origin. */
const foreignProxies = (vercel.rewrites || []).filter((r) => isProxy(r)
  && !/^https:\/\/[a-z0-9-]+-marketbrainosweb\.cloudfunctions\.net\//.test(String(r.destination)));
const emitsShell = /writeFileSync\(path\.join\(DIST, 'app\.html'\)/.test(prerender);

// --- 3b. The cross-project import boundary ---------------------------------------------------
//
// THE SITE BUILD RUNS FROM THE ROOT PACKAGE, AND ONLY THE ROOT PACKAGE.
//
// Several build-time tests import modules out of `functions/src` on purpose, so they exercise the
// SHIPPED function rather than a copy of it. That works only while those modules depend on nothing
// but Node builtins and each other: `functions/node_modules` is not installed on Vercel, so a bare
// `import { Resend } from 'resend'` inside one of them passes every local run — where that folder
// happens to exist — and fails the production build with MODULE_NOT_FOUND.
//
// That is exactly what happened. `functions/src/email/webhook.ts` imported `resend` for signature
// verification; the guard that imports it passed locally, the deploy went out, and the site build
// broke while the functions were already live. The verification is now hand-rolled over
// `node:crypto` and cross-checked against the SDK, and this stops the next one.

const BUILTINS = new Set(builtinModules);
const bare = (src) => [...src.matchAll(/(?:from|import)\s*['"]([^'".][^'"]*)['"]/g)]
  .map((m) => m[1])
  // A builtin is a builtin whether or not it carries the `node:` prefix — `import crypto
  // from 'crypto'` resolves everywhere, and flagging it would train people to ignore this.
  .filter((spec) => !spec.startsWith('node:') && !spec.startsWith('.') && !BUILTINS.has(spec));

const rootPkg = JSON.parse(read('package.json'));
const rootDeps = new Set([
  ...Object.keys(rootPkg.dependencies || {}),
  ...Object.keys(rootPkg.devDependencies || {}),
]);

// Walk what the build-time tests actually reach, rather than guessing which files matter.
const reached = new Set();
const walk = (file) => {
  if (reached.has(file) || !existsSync(path.join(root, file))) return;
  reached.add(file);
  const src = read(file);
  /* BOTH FORMS. The first cut followed only `from '...'`, and the very test that caused this
     bug reaches its module through `await import('...')` — so the walker never visited the
     offending file and the guard reported a clean tree while the build was broken. */
  for (const [, spec] of src.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]*)['"]/g)) {
    const base = path.posix.join(path.posix.dirname(file), spec);
    for (const ext of ['.ts', '.tsx', '.mjs', '.js', '/index.ts']) {
      if (existsSync(path.join(root, base + ext))) walk(base + ext);
    }
  }
};
for (const f of readdirSync(path.join(root, 'scripts'))) {
  if (/\.(ts|mjs)$/.test(f)) walk(`scripts/${f}`);
}

const offenders = [];
for (const file of reached) {
  // Only files OUTSIDE the root package are a problem; the site's own tree installs normally.
  if (!file.startsWith('functions/')) continue;
  for (const spec of bare(read(file))) {
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (!rootDeps.has(pkg)) offenders.push(`${file} imports '${pkg}'`);
  }
}

console.log(`  ${reached.size} modules reachable from scripts/, ${offenders.length} crossing the package boundary`);

// --- 4. Report -----------------------------------------------------------------------------------
const missing = declared.filter((r) => !reachable(r));

console.log(`Checked ${declared.length} declared routes against ${rewrites.length} vercel.json rewrites`);
console.log(`  ${marketing.length + docsRoutes.length} prerendered routes are served from the filesystem`);

if (offenders.length) {
  console.error(`\nFAIL — these modules are imported by build-time tests but need packages the root`);
  console.error(`       package does not install, so the production build cannot resolve them:\n`);
  for (const o of offenders) console.error(`    ${o}`);
  console.error(`\nEither drop the dependency (prefer node: builtins, as escape.ts and paystack.ts do)`);
  console.error(`or add it to the root package.json.\n`);
  process.exit(1);
}

if (badDestinations.length || foreignProxies.length || !emitsShell) {
  console.error(`\nFAIL — app routes must rewrite to /app.html, the clean shell prerender.ts emits.`);
  for (const r of badDestinations) console.error(`    ${r.source} -> ${r.destination}`);
  for (const r of foreignProxies) console.error(`    ${r.source} proxies off-domain -> ${r.destination}`);
  if (!emitsShell) console.error(`    scripts/prerender.ts no longer writes dist/app.html`);
  process.exit(1);
}

if (missing.length) {
  console.error(`\nFAIL — these routes are declared in the app but would 404 in production:\n`);
  for (const r of missing) console.error(`    ${r}`);
  console.error(`\nAdd them to the "rewrites" allowlist in vercel.json.\n`);
  process.exit(1);
}

console.log('\nPASS — every declared route is reachable in production.\n');
