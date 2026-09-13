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

import { readFileSync } from 'node:fs';
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
const marketing = (prerender.match(/const MARKETING = \[([^\]]+)\]/) || [, ''])[1]
  .split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);

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
const badDestinations = (vercel.rewrites || []).filter((r) => r.destination !== '/app.html');
const emitsShell = /writeFileSync\(path\.join\(DIST, 'app\.html'\)/.test(prerender);

// --- 4. Report -----------------------------------------------------------------------------------
const missing = declared.filter((r) => !reachable(r));

console.log(`Checked ${declared.length} declared routes against ${rewrites.length} vercel.json rewrites`);
console.log(`  ${marketing.length + docsRoutes.length} prerendered routes are served from the filesystem`);

if (badDestinations.length || !emitsShell) {
  console.error(`\nFAIL — app routes must rewrite to /app.html, the clean shell prerender.ts emits.`);
  for (const r of badDestinations) console.error(`    ${r.source} -> ${r.destination}`);
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
