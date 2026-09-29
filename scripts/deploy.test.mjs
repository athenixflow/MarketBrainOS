// Guards the Vercel build against the one way it keeps failing: a file the build touches needs a
// package that only functions/ installs.
//
// Vercel runs `npm install` at the ROOT and then `npm run build`. It never installs functions/,
// so functions/node_modules does not exist there — but it does on every developer machine, which is
// why each of these passed locally and failed in production:
//
//   2026-09-24  ac5c296  a build-time test reached functions code importing `resend`
//   2026-09-29  4d0b112  scripts/study/classify.ts required functions/node_modules/@google/generative-ai
//                        at import time, and scripts/study.test.ts imports it
//
// So this walks the real import graph — from every script the build command runs, and from the
// app entry vite bundles — and fails if anything reached needs a package the root install does not
// provide. It runs FIRST in the build, in under a second, so a break shows up here and not four
// minutes into a deploy.
//
// A require inside a function body (`const loadSdk = () => require(...)`) is allowed: it only runs
// when called, and nothing the build runs calls it. A require or import at the top level is not.
//
// `npm run test:deploy` runs it alone.

import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const ROOT_PACKAGES = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
const BUILTINS = new Set(builtinModules);

let failures = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

/** What the build command runs, read from package.json so a new step is covered the day it is added. */
export const buildEntries = (buildCmd) => [...buildCmd.matchAll(/(?:tsx|node)\s+(scripts\/[\w./-]+\.(?:ts|mjs|js))/g)].map((m) => m[1]);

const CODE = /\.(tsx?|mjs|cjs|js)$/;
const EXTS = ['', '.ts', '.tsx', '.mjs', '.js', '.cjs', '/index.ts', '/index.tsx', '/index.js'];
const resolveRelative = (from, spec, exists) => {
  const base = path.resolve(path.dirname(from), spec);
  for (const e of EXTS) { const p = base + e; if (exists(p)) return p; }
  return null;
};
const packageName = (spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);

/** Comments blanked, so an import in prose is not an import. */
const blank = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  .replace(/^(\s*)\/\/.*$/gm, (c) => c.replace(/[^\n]/g, ' '));

/**
 * Every specifier a file needs AT LOAD TIME. Static imports and re-exports always load; `import type`
 * never does. A dynamic `import()` always counts: vite bundles every one (the app's pages are
 * `lazy(() => import(...))`), so it has to resolve whether or not it runs. A `require()` counts
 * unless it sits behind an arrow or a function body (the lazy-load pattern the study scripts use).
 */
export const loadTimeSpecifiers = (source) => {
  const src = blank(source);
  const out = [];
  for (const m of src.matchAll(/^\s*(?:import|export)\s+(?!type\s)(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm)) out.push(m[1]);
  for (const line of src.split('\n')) {
    for (const m of line.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]);
    for (const m of line.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const before = line.slice(0, m.index);
      const lazy = /^\s{2,}/.test(line) || /\bfunction\b|=>/.test(before);
      if (!lazy) out.push(m[1]);
    }
  }
  return out;
};

/** Walks the graph from `entries`; returns [file, specifier, reason] for everything Vercel cannot resolve. */
export const unresolvable = (entries, readFile = (f) => fs.readFileSync(f, 'utf8'), exists = (f) => fs.existsSync(f) && fs.statSync(f).isFile()) => {
  const seen = new Set();
  const problems = [];
  const stack = entries.map((e) => path.resolve(root, e));
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file) || !CODE.test(file)) continue;
    seen.add(file);
    if (!exists(file)) { problems.push([file, '(entry)', 'file does not exist']); continue; }
    for (const spec of loadTimeSpecifiers(readFile(file))) {
      if (spec.startsWith('.') || spec.startsWith('/')) {
        if (/[\\/]node_modules[\\/]/.test(spec)) {
          if (/functions[\\/]node_modules/.test(path.resolve(path.dirname(file), spec).replace(/\\/g, '/'))) {
            problems.push([file, spec, 'reaches into functions/node_modules, which Vercel never installs']);
          }
          continue;
        }
        if (/\.(css|svg|png|jpe?g|webp|json|txt|md)(\?.*)?$/.test(spec)) continue;
        const target = resolveRelative(file, spec.replace(/\?.*$/, ''), exists);
        if (target) stack.push(target);
        continue;
      }
      if (spec.startsWith('node:') || BUILTINS.has(spec) || BUILTINS.has(packageName(spec))) continue;
      if (spec.startsWith('virtual:') || spec.startsWith('~') ) continue;
      if (!ROOT_PACKAGES.has(packageName(spec))) {
        const where = file.includes(`${path.sep}functions${path.sep}`) ? ' (a functions/ package reached from the root build)' : '';
        problems.push([file, spec, `not a root dependency${where}`]);
      }
    }
  }
  return { problems, visited: seen.size };
};

/* ---------------------------------------------------------------- the real build */

console.log('WHAT VERCEL CAN INSTALL:');
/* Not this file: its controls quote the broken imports as strings, and it imports nothing but builtins. */
const entries = [...buildEntries(pkg.scripts.build).filter((e) => e !== 'scripts/deploy.test.mjs'), 'index.tsx'];
ok(entries.length > 10 && entries.includes('scripts/study.test.ts') && entries.includes('scripts/prerender.ts'),
  `the build command's ${entries.length - 1} steps and the app entry are all walked`);
const { problems, visited } = unresolvable(entries);
for (const [file, spec, why] of problems) console.log(`      ${path.relative(root, file)}: '${spec}' — ${why}`);
ok(problems.length === 0, `every one of the ${visited} files the build loads resolves from the root install`,
  `${problems.length} problem(s) above`);

/* ---------------------------------------------------------------- negative controls */

console.log('\nCONTROLS:');
const fake = (files) => ({
  read: (f) => files[path.relative(root, f).replace(/\\/g, '/')],
  exists: (f) => path.relative(root, f).replace(/\\/g, '/') in files,
});
const probe = (files, entry = 'scripts/x.test.ts') => { const f = fake(files); return unresolvable([entry], f.read, f.exists).problems; };

ok(probe({ 'scripts/x.test.ts': "import { a } from '../functions/src/w';", 'functions/src/w.ts': "import { Resend } from 'resend';\nexport const a = 1;" }).length === 1,
  'CONTROL (the Sep 24 break): a test reaching functions code that imports `resend` is caught');
ok(probe({ 'scripts/x.test.ts': "import { b } from './s/c';", 'scripts/s/c.ts': "const require = createRequire(import.meta.url);\nconst { G } = require('../../functions/node_modules/@google/generative-ai');\nexport const b = 1;" }).length === 1,
  'CONTROL (the Sep 29 break): a top-level require of functions/node_modules is caught');
ok(probe({ 'scripts/x.test.ts': "import { b } from './s/c';", 'scripts/s/c.ts': "const loadSdk = () => require('../../functions/node_modules/@google/generative-ai');\nexport const b = 1;" }).length === 0,
  'a lazy require behind an arrow function is allowed');
ok(probe({ 'scripts/x.test.ts': "import type { T } from 'resend';\nimport fs from 'node:fs';\nimport path from 'path';" }).length === 0,
  'type-only imports and Node builtins are allowed');
ok(probe({ 'scripts/x.test.ts': "// import { R } from 'resend';\n/* require('resend') */\nexport {};" }).length === 0,
  'an import inside a comment is not an import');
ok(probe({ 'scripts/x.test.ts': "export { z } from 'left-pad-unlisted';" }).length === 1,
  'CONTROL: a re-export from an unlisted package is caught');
ok(probe({ 'scripts/x.test.ts': "import './missing';" }).length === 0 && probe({}, 'scripts/gone.test.ts').length === 1,
  'CONTROL: a build step pointing at a file that does not exist is caught');
ok(buildEntries('node scripts/a.mjs && tsx scripts/b/c.test.ts && tsc && vite build').join() === 'scripts/a.mjs,scripts/b/c.test.ts',
  'build steps are read from the command itself');

console.log(failures ? `\nFAIL — ${failures} check(s) failed.` : '\nPASS — everything the build loads is installed by the root `npm install` Vercel runs.');
process.exit(failures ? 1 : 0);
