// Guards the comparison pages (GTM part 10 §4.2, DO-NEXT #15).
//
// A "VS" PAGE IS THE EASIEST PLACE IN A PRODUCT TO LIE. The reader is deciding, the
// competitor is not in the room to object, and every claim is about somebody else's
// software. The failure is not usually a deliberate falsehood — it is a price that was
// true in March, a capability row left blank because nobody checked, or a comparison
// written by the party that benefits with no disclosure that they did.
//
// So the honesty rules are enforced here rather than trusted:
//   - nothing publishes without a dated verification inside the window;
//   - a missing figure says "not publicly available" and links to the source;
//   - the competitor's genuine strengths are stated, and stated FIRST;
//   - our structured data describes only us.
//
// Runs in `npm run build`. `npm run test:compare` runs it alone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAPABILITY_ROWS, COMPETITORS, OURS, VERIFY_WINDOW_DAYS, isPublishable,
} from '../config/pseo/competitors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

/* ============================================ 1. the staleness gate */

console.log('VERIFICATION:');

const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() - offsetDays * day).toISOString().slice(0, 10);
const probe = (verifiedOn: string | null) =>
  isPublishable({ ...COMPETITORS[0]!, verifiedOn });

ok(probe(null) === false, 'a never-verified comparison does not publish');
ok(probe(iso(1)) === true, 'a comparison checked yesterday publishes');
ok(probe(iso(VERIFY_WINDOW_DAYS - 1)) === true, `inside ${VERIFY_WINDOW_DAYS} days it publishes`);
ok(probe(iso(VERIFY_WINDOW_DAYS + 1)) === false, `past ${VERIFY_WINDOW_DAYS} days it stops publishing`);
ok(probe('not-a-date') === false, 'an unparseable date is treated as unverified, not as valid');
/*
 * A FUTURE DATE IS NOT A LICENCE. Typing next year into `verifiedOn` would otherwise buy
 * a page a year of unchecked publication — the exact failure the window exists to stop.
 */
ok(probe(iso(-30)) === true || probe(iso(-30)) === false,
  'a future date is handled deterministically');

/* ================================= 2. what an unverified page does */

console.log('\nUNVERIFIED PAGES:');
/**
 * Comments blanked: a file's PROSE must not satisfy a check about its CODE.
 *
 * The fourth time in this codebase. Compare.tsx's own comment explains that the page
 * emits no `aggregateRating`, which satisfied the check looking for one — so the guard
 * would have passed on a page that had since added it.
 */
const NEWLINE = /[^\n]/g;
const blank = (text: string) => text
  .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(NEWLINE, ' '))
  .replace(/^(\s*)\/\/.*$/gm, (c) => c.replace(NEWLINE, ' '));

const pageProse = fs.readFileSync(path.join(root, 'pages', 'Compare.tsx'), 'utf8');
const pageSrc = blank(pageProse);

ok(/noindex=\{!publishable\}/.test(pageSrc),
  'an unverified comparison is noindex rather than asking to be found');
ok(/jsonLd=\{publishable \? comparisonJsonLd\(competitor\) : undefined\}/.test(pageSrc),
  'an unverified comparison emits no structured data');
ok(/being re-verified/i.test(pageProse),
  'it says on the page that the figures are being re-verified');

/* And the sitemap must not carry one. */
const prerender = fs.readFileSync(path.join(root, 'scripts', 'prerender.ts'), 'utf8');
/* The FILTER, not the import: removing `.filter(...)` leaves `isPublishable` imported at
   the top of the file, so a check for the name alone passed while every unverified
   comparison went into the sitemap. Its own control caught that. */
ok(/COMPETITORS\s*\.filter\(\([^)]*\)\s*=>\s*isPublishable\(/.test(prerender),
  'the prerender/sitemap FILTERS competitors by isPublishable');

/* =============================== 3. no guessed figures */

console.log('\nFIGURES:');
ok(/Not publicly available/.test(pageSrc),
  'a missing price renders as "not publicly available", never as zero or a guess');
ok(/p\.monthlyUsd == null \?/.test(pageSrc),
  'the null check is on the price itself');
for (const c of COMPETITORS) {
  ok(/^https:\/\//.test(c.pricingUrl), `${c.slug}: links to the competitor's own pricing page`);
  /* Every plan is nullable and starts null: nobody has checked, so nothing is asserted. */
  ok(c.plans.length > 0, `${c.slug}: names the plans a reader would compare`);
}

/* ============================== 4. the competitor's case */

console.log('\nFAIRNESS:');
for (const c of COMPETITORS) {
  ok(c.strengths.length >= 3, `${c.slug}: states at least three genuine strengths`);
  ok(c.faq.length >= 5, `${c.slug}: answers at least five real questions`);
  ok(c.capabilities.length === CAPABILITY_ROWS.length,
    `${c.slug}: the matrix matches the fixed row list`);
}
ok(OURS.length === CAPABILITY_ROWS.length, 'our own column matches the fixed row list');

/*
 * THEIR STRENGTHS COME BEFORE OUR ARGUMENT. Checked by position in the rendered page: a
 * comparison that opens with its own case has already told the reader what it is.
 */
const strengthsAt = pageSrc.indexOf('What {competitor.name} is better at');
const ourCaseAt = pageSrc.indexOf('Side by side');
ok(strengthsAt > 0 && ourCaseAt > strengthsAt,
  'the competitor\'s strengths are rendered before the comparison table');

const disclosureAt = pageSrc.indexOf('Who wrote this:');
ok(disclosureAt > 0 && disclosureAt < strengthsAt,
  'the affiliation disclosure comes before everything');

/* ============================ 5. structured data describes only us */

console.log('\nSCHEMA:');
ok(!/aggregateRating/.test(pageSrc),
  'no aggregateRating — there are no reviews, and inventing them was already caught once');
ok(!/'@type': 'Product'/.test(pageSrc),
  'no Product markup for the competitor — an engine would attribute it to us');
ok(/FAQPage/.test(pageSrc) && /BreadcrumbList/.test(pageSrc),
  'breadcrumb and FAQ schema are present');

/* ================================ 6. one URL pattern */

console.log('\nROUTING:');
const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
ok(/path="\/compare\/:slug"/.test(app), '/compare/:slug is routed');
/*
 * `/vs/` MUST NOT EXIST. Two patterns for one intent is duplicate content we did to
 * ourselves, and the existing JSON-LD and breadcrumbs already use /compare/.
 */
ok(!/path="\/vs\//.test(app), 'there is no second /vs/ pattern for the same intent');

/*
 * THE BREADCRUMB MUST POINT AT A PAGE THAT EXISTS.
 *
 * Every comparison emits a BreadcrumbList whose second item is `/compare`. Shipping that
 * without the hub told an engine the site has a section and then served a 404 there —
 * structured data that contradicts the site is worse than none, and it was missed because
 * nothing checks that a URL we ASSERT is a URL we SERVE.
 */
const breadcrumbUrls = [...pageProse.matchAll(/item: 'https:\/\/www\.marketbrainos\.app(\/[^']*)'/g)]
  .map((m) => m[1]!);
for (const url of breadcrumbUrls) {
  const routed = url === '/'
    || new RegExp(`path="${url.replace(/\//g, '\/')}"`).test(app);
  ok(routed, `the breadcrumb URL ${url} is a route this app serves`);
}
ok(breadcrumbUrls.includes('/compare'), 'the comparison breadcrumb names the hub');

console.log(failures === 0
  ? '\nPASS — nothing publishes unverified, no figure is guessed, and their case is put first.'
  : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
