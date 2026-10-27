/**
 * Every route whose page brings its own public chrome (PublicLayout, directly or through LegalPage)
 * must be on the public-route list, or a signed-in visitor gets the app header and sidebar with the
 * public nav stacked inside (found on /compare, /press, /status, the scorer and the study by the E2E
 * run). And no signed-in-only route may be on it, or the app loses its sidebar there.
 *   npx tsx scripts/public-routes.test.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPublicRoute } from '../config/publicRoutes';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
let failed = 0;
const ok = (cond: boolean, msg: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failed++;
};

/* Component name -> source file, from both static and lazy imports. */
const files = new Map<string, string>();
for (const m of app.matchAll(/import (\w+) from '\.\/((?:pages|components)\/[\w/]+)'/g)) files.set(m[1], m[2]);
for (const m of app.matchAll(/const (\w+) = lazy\(\(\) => import\('\.\/((?:pages|components)\/[\w/]+)'\)\)/g)) files.set(m[1], m[2]);
const source = (rel: string) => {
  for (const ext of ['.tsx', '.ts']) { const p = path.join(root, rel + ext); if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8'); }
  return '';
};
export const usesPublicChrome = (text: string): boolean => /from '\.\.\/components\/(PublicLayout|LegalPage)'/.test(text);

/* Routes with a single unconditional page are public candidates; `user ? <X /> : <Navigate …>` are app routes. */
const routes = [...app.matchAll(/<Route path="([^"]+)" element=\{(.*?)\} \/>/g)].map((m) => ({ path: m[1], element: m[2] }));
const sample = (p: string) => p.replace(/:\w+/g, 'example').replace(/\/\*$/, '/getting-started');

console.log('ROUTES WITH THEIR OWN PUBLIC CHROME ARE ON THE LIST:');
let checked = 0;
for (const r of routes) {
  const only = r.element.match(/^<(\w+) \/>$/);
  if (!only || !files.has(only[1])) continue;
  if (!usesPublicChrome(source(files.get(only[1])!))) continue;
  checked++;
  ok(isPublicRoute(sample(r.path)), `${r.path} (${only[1]} uses PublicLayout) is a public route`);
}
ok(checked >= 10, `found the pages that use PublicLayout (${checked})`);

console.log('\nSIGNED-IN-ONLY ROUTES KEEP THE APP CHROME:');
for (const r of routes.filter((r) => /^user \? <\w+ \/> : <Navigate/.test(r.element))) {
  ok(!isPublicRoute(r.path), `${r.path} is not a public route`);
}
ok(!isPublicRoute('/'), '/ is not public (signed-in users get the dashboard there)');

console.log('\nCONTROLS:');
ok(usesPublicChrome("import PublicLayout from '../components/PublicLayout';"), 'CONTROL: a page importing PublicLayout is detected');
ok(usesPublicChrome("import LegalPage, { LegalSection } from '../components/LegalPage';"), 'CONTROL: a legal page is detected');
ok(!usesPublicChrome("import { Card } from '../components/UI';"), 'CONTROL: an app page is not');
ok(isPublicRoute('/documentation/tools/angle-miner') && !isPublicRoute('/documentationx'), 'CONTROL: the docs prefix matches sub-pages only');

console.log(failed ? `\nFAILED — ${failed} assertion(s).` : '\nPASS — no page shows the app chrome and the public nav together.');
process.exit(failed ? 1 : 0);
