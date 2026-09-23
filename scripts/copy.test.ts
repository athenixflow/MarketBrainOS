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
  /* EMAIL IS COPY TOO, and the most durable kind: it sits in an inbox, gets forwarded,
     and cannot be corrected by a deploy once sent. The guard did not scan it, and the
     welcome email was still promising to "predict which angle or ad wins" long after
     that claim was removed from every screen. */
  ...walk(path.join(root, 'functions', 'src', 'email')),
].filter((f) => fs.existsSync(f));

/**
 * A file's COMMENTS are not its copy.
 *
 * Trailing `//` was already stripped; block comments were not, so the note in
 * `pricingConfig.ts` explaining that billing is simulated read as a claim that the
 * PRODUCT simulates performance, and the build failed on an explanation of why the
 * build should fail. Blanked rather than removed, so reported line numbers still point
 * where the reader expects. TS/TSX only: `/*` inside an HTML or text source is content.
 */
const blankBlockComments = (text: string, file: string): string =>
  (/\.tsx?$/.test(file)
    ? text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    : text);

const grep = (re: RegExp, exempt?: RegExp): string[] => {
  const hits: string[] = [];
  for (const f of sources) {
    blankBlockComments(fs.readFileSync(f, 'utf8'), f).split(/\r?\n/).forEach((line, i) => {
      // Strip trailing comments only - a `//` inside a URL is not a comment.
      const code = line.replace(/(^|\s)\/\/.*$/, '');
      if (!re.test(code)) return;
      /* Tested against the WHOLE line, never the truncated hit below: the first cut
         filtered the 100-character preview, so a permission scope named at the end of a
         long line escaped its own exemption and an internal identifier was reported as
         marketing copy. */
      if (exempt && exempt.test(code)) return;
      /* Print the real source line, not the blanked one, or the report is unreadable. */
      const shown = (fs.readFileSync(f, 'utf8').split(/\r?\n/)[i] ?? line).trim();
      hits.push(`${path.relative(root, f)}:${i + 1}: ${shown.slice(0, 100)}`);
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

/*
 * THE CLAIMS NOBODY CAN SUBSTANTIATE (GTM DO-NOW #2, part 19 §1).
 *
 * The product makes one model call per run. It reviews, scores and explains; it does not
 * forecast results. "Predicts the winner", "simulates performance", "win probability" and
 * the unsourced "80% of campaigns fail" are claims about the future, or about evidence
 * that does not exist — the class the FTC's Operation AI Comply targets, and the first
 * thing a reporter asks for a source on. They were removed once; this is what stops them
 * drifting back one adjective at a time.
 *
 * THE MODULE IDS ARE NOT COPY. `TestLab_Simulation` and `simulation:execute` are internal
 * identifiers nobody reads, and renaming them would break stored records and routing. The
 * "simulated payments" disclosures are TRUE and must stay. So the exemptions below are
 * narrow and named, rather than the check being weakened.
 */
console.log('\nSUBSTANTIATION:');
const DENIAL = /(?:does not|do not|doesn't|never|not a|nor)\s+(?:\w+\s+){0,3}(?:predict|forecast|simulat)/i;
const IDENTIFIER = /TestLab_Simulation|simulation:execute/;

const predicts = grep(/\bpredict(s|ed|ive|ion)?\b/i, new RegExp(`${DENIAL.source}|${IDENTIFIER.source}`, 'i'));
ok(predicts.length === 0, 'no copy claims the product predicts results', predicts.join('\n        '));

const simulates = grep(
  /\bsimulat(e|es|ed|ing|ion|or)\b/i,
  new RegExp(`${DENIAL.source}|${IDENTIFIER.source}|simulated payment|\\(simulated\\)`, 'i'),
);
ok(simulates.length === 0, 'no copy claims the product simulates performance', simulates.join('\n        '));

const winProb = grep(/win probability/i);
ok(winProb.length === 0, 'no "Win Probability" — the score is a judgement, not a likelihood', winProb.join('\n        '));

const unsourced = grep(/\b\d{2}%\s+of\s+(marketing\s+)?campaigns\b/i);
ok(unsourced.length === 0, 'no unsourced failure statistic in the hook', unsourced.join('\n        '));

const fakeCorpus = grep(/database of high-performing|high-performance benchmarks/i);
ok(fakeCorpus.length === 0, 'no claim of a benchmark database the code does not have', fakeCorpus.join('\n        '));

/*
 * AND THE SERVER ASKS FOR WHAT THE SCREEN PROMISES. Renaming the label while the prompt
 * still said "predict how these variants would perform" would change the word and keep
 * the claim: the screen and the thing generating its content have to agree.
 */
const server = fs.readFileSync(path.join(root, 'functions', 'src', 'index.ts'), 'utf8');
/*
 * ANCHORED ON WHAT IS UNIQUE. The first cut located the prompt by its opening words —
 * "As a senior conversion copywriter" — which TWO prompts in that file share, so
 * `indexOf` found the other one and the check passed while the claim was back in place.
 * Its own negative control caught it. These two assertions name the claim itself rather
 * than a position in the file, so nothing about prompt ordering can fool them.
 */
ok(!/predict how these [^`]{0,40}variants would perform/i.test(server),
  'no prompt asks the model to forecast how variants will perform');
ok(/0-100 persuasive strength[\s\S]{0,400}NOT a forecast/i.test(server),
  'the variant score is defined as a judgement about the copy, not a forecast');

/*
 * ONE NAME, AND NEVER THE AMBIGUOUS HALF OF IT (GTM part 11 §7).
 *
 * "MarketBrain" alone resolves to MarketBrain LLC, a Dallas marketing agency, and the AI
 * search audit found that a query for the product returns them, `marketbrain.me` and
 * Wikipedia's Marketo before it returns this. An engine cannot disambiguate an entity
 * that refers to itself by the colliding name, so the product is "MarketBrain OS"
 * everywhere in prose. `MarketBrainOS` (no space) is the registered alternateName and is
 * correct in wordmarks and identifiers.
 */
console.log('\nENTITY:');
/* `&nbsp;` IS A SPACE. Three correct uses of the full name — the email layout's wordmark
   and the docs header — were reported as the Dallas agency because an HTML entity is not
   `\s`. A guard that flags the correct spelling is one somebody switches off. */
const bareName = grep(
  /\bMarketBrain\b(?!(?:\s|&nbsp;|&#160;)*OS\b)(?!OS)/,
  /MarketBrain_|marketbrainos|MarketBrainOS/i,
);
ok(bareName.length === 0,
  'the product is never called "MarketBrain" alone — that is a Dallas agency',
  bareName.join('\n        '));

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
