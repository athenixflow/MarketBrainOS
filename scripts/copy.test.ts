// Guards the marketing/docs copy against the drift an independent QA audit (Sep 2026) found:
// a homepage pricing widget that contradicted the config, placeholder testimonials shipped to
// production, "13 tools" copy for a product with 14, and a robots.txt that let crawlers into /admin.
//
// Runs in `npm run build`. `npm run test:copy` runs it alone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

const walk = (dir: string, out: string[] = []): string[] => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|html|txt)$/.test(e.name)) out.push(full);
  }
  return out;
};
const sources = [
  ...walk(path.join(root, 'pages')), ...walk(path.join(root, 'components')), ...walk(path.join(root, 'config')),
  path.join(root, 'App.tsx'), path.join(root, 'index.html'), path.join(root, 'scripts', 'prerender.ts'),
].filter((f) => fs.existsSync(f));

const grep = (re: RegExp): string[] => {
  const hits: string[] = [];
  for (const f of sources) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      // Strip trailing comments only - a `//` inside a URL is not a comment.
      if (re.test(line.replace(/(^|\s)\/\/.*$/, ''))) hits.push(`${path.relative(root, f)}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  return hits;
};

console.log('COPY GUARDS:');
const thirteen = grep(/\b(13|thirteen)\b[^\n]{0,40}\b(tools?|analy[sz]ers?|analysis tools)\b/i);
ok(thirteen.length === 0, 'no "13 tools / thirteen analyzers" copy (the product has 14)', thirteen.join('\n        '));
const nineGeneric = grep(/\bnine generic\b/i);
ok(nineGeneric.length === 0, 'no "nine generic" (there are ten)', nineGeneric.join('\n        '));
const fourSuites = grep(/\bfour\b[^\n]{0,30}\bsuites?\b|\b4 suites\b/i);
ok(fourSuites.length === 0, 'no "four suites" (there are five)', fourSuites.join('\n        '));
const placeholders = grep(/Sample Persona|Illustrative samples|replace with real customer quotes/i);
ok(placeholders.length === 0, 'no placeholder testimonials in shipped copy', placeholders.join('\n        '));
const credits = grep(/Analysis Credits/);
ok(credits.length === 0, 'no hardcoded "Analysis Credits" pricing copy (config says tokens)', credits.join('\n        '));
const landing = fs.readFileSync(path.join(root, 'pages', 'LandingPage.tsx'), 'utf8');
ok(/from ['"]\.\.\/config\/pricingConfig['"]/.test(landing), 'LandingPage imports the pricing config');
ok(/\{FREE_TOKENS\}|\{PRO_TOKENS\}|\{PRO_PRICE\}/.test(landing), 'LandingPage renders its figures from the config, not literals');
ok(!/TESTIMONIALS/.test(landing), 'LandingPage no longer renders the TESTIMONIALS section');

console.log('\nROBOTS:');
const robots = fs.readFileSync(path.join(root, 'public', 'robots.txt'), 'utf8');
ok(/^Disallow:\s*\/admin$/m.test(robots), 'robots.txt disallows /admin (bare, which also covers /admin/*)');
ok(/^Disallow:\s*\/app\.html$/m.test(robots), 'robots.txt disallows the app shell');
ok(/^Allow:\s*\/$/m.test(robots) && /^Sitemap:/m.test(robots), 'robots.txt still allows the site and names the sitemap');

console.log('\nHONEYPOT:');
const ui = fs.readFileSync(path.join(root, 'components', 'UI.tsx'), 'utf8');
ok(!/href="\/admin\/debug/.test(ui), 'the honeypot no longer points into the real /admin route family');
ok(!/>\s*Internal Logs\s*</.test(ui), 'the honeypot no longer carries human-readable admin wording');

console.log(failures === 0 ? '\nPASS — copy, robots and honeypot guards hold.' : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
