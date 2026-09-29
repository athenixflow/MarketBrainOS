// Guards the prefilled first run (GTM part 03 §4, experiment E03).
//
// THE FAILURE THIS EXISTS FOR IS SILENT.
//
// A prefill is a bag of string keys aimed at a form the config file cannot see. Rename an
// input key in `toolConfigs.ts`, move a tool's slug, or mistype `audiance`, and nothing
// throws: the overlay still shows three confident cards, the tool still opens, and the
// fields are simply empty. The experiment then measures a feature that is not running, and
// the honest-looking conclusion is "prefilling did not help".
//
// So every key is checked against the form it targets, every route against the router, and
// every token figure against TOKEN_COSTS.
//
// Runs in `npm run build`. `npm run test:onboarding` runs it alone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ONBOARDING_EXAMPLES } from '../config/onboardingExamples';
import { TOOL_CONFIGS } from '../config/toolConfigs';

/* TOOL_CONFIGS is keyed by module id, not a list. */
const TOOLS = Object.values(TOOL_CONFIGS);
import { TOKEN_COSTS } from '../types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
/* Comments blanked before any source match: a file's own prose about prefilling must never
   be what satisfies a check about prefilling. */
const blank = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

/* ============================ 1. every example is complete and distinct */

console.log('THE EXAMPLES:');

ok(ONBOARDING_EXAMPLES.length >= 3, `${ONBOARDING_EXAMPLES.length} examples offered`);
ok(new Set(ONBOARDING_EXAMPLES.map((e) => e.id)).size === ONBOARDING_EXAMPLES.length,
  'every example id is unique — the destination looks one up by id');
/* Three cards that all open the same tool is a menu pretending to be a choice. */
ok(new Set(ONBOARDING_EXAMPLES.map((e) => e.path)).size === ONBOARDING_EXAMPLES.length,
  'they lead to different tools');

for (const e of ONBOARDING_EXAMPLES) {
  ok(e.title.length > 10 && e.blurb.length > 20, `${e.id}: has a title and a blurb`);
  ok(Object.keys(e.prefill).length >= 3,
    `${e.id}: prefills at least three fields`, `${Object.keys(e.prefill).length}`);
  ok(Object.values(e.prefill).every((v) => typeof v === 'string' && v.trim().length > 0),
    `${e.id}: no prefilled field is blank`);
}

/* ============================ 2. the keys hit a real form */

console.log('\nTHE KEYS REACH A FIELD:');

const app = blank(read('App.tsx'));

for (const e of ONBOARDING_EXAMPLES) {
  const slug = e.path.replace(/^\//, '');
  const generic = TOOLS.find((c) => c.slug === slug);

  if (generic) {
    const fieldKeys = new Set(generic.inputs.map((f) => f.key));
    const missed = Object.keys(e.prefill).filter((k) => !fieldKeys.has(k));
    ok(missed.length === 0,
      `${e.id}: every key matches a field of ${generic.title}`,
      `no such field: ${missed.join(', ')}`);
    /* And the cost shown on the card is the cost the tool charges. */
    ok(e.cost === (TOKEN_COSTS as Record<string, number>)[generic.costKey],
      `${e.id}: the card's token figure matches the tool`,
      `card ${e.cost} vs tool ${(TOKEN_COSTS as Record<string, number>)[generic.costKey]}`);
  } else {
    /*
     * A BESPOKE PAGE, so the fields are its own `useState` names rather than a config. The
     * check reads the page: a key that never appears in a `useState` call there is a key
     * that prefills nothing.
     */
    const pageFile = ['pages/ConversionDoctor.tsx', 'pages/AngleMinerX.tsx', 'pages/TestLabPro.tsx', 'pages/Workflow.tsx']
      .find((f) => blank(read(f)).includes(`example?.prefill`));
    ok(Boolean(pageFile), `${e.id}: its bespoke page reads a prefill at all`, e.path);
    if (pageFile) {
      const src = blank(read(pageFile));
      const unread = Object.keys(e.prefill).filter((k) => !src.includes(`example?.prefill.${k}`));
      ok(unread.length === 0,
        `${e.id}: every key is read by ${pageFile}`,
        `never read: ${unread.join(', ')}`);
    }
    ok(e.cost === TOKEN_COSTS.ConversionDoctor || e.cost > 0, `${e.id}: carries a token cost`);
  }

  /* The route has to exist, or the card is a 404 with a token price on it. */
  ok(app.includes(`path="${e.path}"`) || app.includes(`path="${slug}"`) || TOOLS.some((c) => c.slug === slug),
    `${e.id}: ${e.path} is a real route`);
}

/* ============================ 3. both halves of the handoff */

console.log('\nTHE HANDOFF:');

const overlay = blank(read('components/OnboardingOverlay.tsx'));
ok(/state: \{ exampleId: example\.id \}/.test(overlay),
  'the overlay hands the example on in router state');
/*
 * NOT A QUERY STRING. A URL carrying the example copy would be shareable, bookmarkable and
 * indexable, and none of those are things anybody wants from somebody else's draft inputs.
 */
ok(!/searchParams|\?example=/.test(overlay), 'and not in the URL');
ok(/track\('template_used'/.test(overlay), 'and records which one was picked');

for (const [file, label] of [
  ['components/ToolPage.tsx', 'the generic tools'],
  ['pages/ConversionDoctor.tsx', 'Conversion Doctor'],
] as const) {
  const src = blank(read(file));
  ok(/findExample\(\(location\.state as any\)\?\.exampleId\)/.test(src),
    `${label} read it back`);
  /*
   * THE NOTICE IS THE FEATURE, NOT A DECORATION. Prefilled fields that do not announce
   * themselves let somebody spend four tokens on a careful audit of a company that does
   * not exist, and find out afterwards.
   */
  /* GATED ON THE STATE, not merely present. The first cut matched `<ExampleNotice`
     anywhere in the file, so wrapping it in `{false && (...)}` — the exact shape of
     somebody switching it off — passed clean. A control proved it. */
  ok(/\{showExampleNotice && \(\s*<ExampleNotice/.test(src),
    `${label} say the inputs are examples`);
  ok(/useState\(Boolean\(example\)\)/.test(src),
    `${label} show it whenever an example was carried in`);
  ok(/onClear=\{/.test(src), `${label} offer a way to empty them`);
}

/* The generic path must ignore a key that is not a field of the tool it landed on, rather
   than stuffing it into the values map where nothing will ever render it. */
const toolPage = blank(read('components/ToolPage.tsx'));
ok(/if \(key in v\) v\[key\] = value;/.test(toolPage),
  'a key that is not a field of this tool is dropped, not stored');
ok(/example\.path !== `\/\$\{config\.slug\}`/.test(toolPage),
  "and an example meant for another tool does not prefill this one");

/* ============================ 4. the overlay is one screen now */

console.log('\nONE SCREEN:');

/*
 * E03's whole claim is that five screens of explanation before any value was the problem.
 * If the step array creeps back, the experiment is measuring something else.
 */
ok(!/const STEPS/.test(overlay), 'the five explanatory steps are gone');
ok(/What are you deciding\?/.test(read('components/OnboardingOverlay.tsx')),
  'it asks one question');
ok(/I&rsquo;ll start from scratch|start from scratch/.test(read('components/OnboardingOverlay.tsx')),
  'and somebody who wants a blank form can still have one');

console.log(failures === 0
  ? '\nPASS — every example fills a real form, says it is an example, and can be cleared.'
  : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
