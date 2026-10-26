/**
 * The route manifest the sweep visits, read from the code the app actually declares (the same
 * approach as scripts/routes.test.mjs), so a route added later is swept without editing this file.
 * Docs ARTICLES are not listed here: docs.spec.ts crawls them from the docs sidebar itself.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

const app = read('App.tsx');
const appRoutes = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]).filter((r) => r !== '*');
const toolSlugs = [...read('config/toolConfigs.ts').matchAll(/slug:\s*'([a-z0-9-]+)'/g)].map((m) => `/${m[1]}`);
const adminSubs = [...read('components/admin/AdminPortal.tsx').matchAll(/<Route\s+path="([a-z-]+)"/g)].map((m) => `/admin/${m[1]}`);
const docCategories = [...read('config/docs/registry.ts').matchAll(/\{ id: '([a-z-]+)', title:/g)].map((m) => `/documentation/${m[1]}`);

export const COMPARE_SLUGS = ['chatgpt', 'claude', 'gemini'];

const concrete = (r: string) => r.replace(/\/\*$/, '');
const expanded = appRoutes.flatMap((r) =>
  r === '/compare/:slug' ? COMPARE_SLUGS.map((s) => `/compare/${s}`)
  : r === '/admin/*' ? ['/admin', ...adminSubs]
  : r === '/documentation/*' ? ['/documentation', ...docCategories]
  : r.includes(':') ? []
  : [concrete(r)],
);

export const ALL_ROUTES = [...new Set([...expanded, ...toolSlugs])].sort();

/** Pages anyone can open. Everything else needs a session. */
export const PUBLIC = new Set([
  '/', '/features', '/pricing', '/about', '/faq', '/privacy', '/terms', '/status', '/press', '/compare',
  ...COMPARE_SLUGS.map((s) => `/compare/${s}`), '/tools/landing-page-score', '/research/landing-page-study-2026',
  '/documentation', ...docCategories, '/auth', '/auth/action',
]);

export type Expectation = 'render' | 'to-auth' | 'to-home';

/** What a visitor with this role should get on this route, per the guards in App.tsx. */
export function expectFor(route: string, role: string | null): Expectation {
  if (route === '/auth') return role ? 'to-home' : 'render';
  if (route.startsWith('/admin')) return !role ? 'to-auth' : role === 'admin' ? 'render' : 'to-home';
  if (PUBLIC.has(route)) return 'render';
  return role ? 'render' : 'to-auth';
}

/** File-safe name for a route's screenshot. */
export const slugOf = (route: string) => (route === '/' ? 'home' : route.slice(1).replace(/[/:]/g, '_'));
