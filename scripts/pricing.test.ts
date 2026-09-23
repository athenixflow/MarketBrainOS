// Guards the pricing ladder (GTM parts 19 §4, 20 §2, 15 §B7).
//
// THE CONFIG EXISTS TWICE. `config/pricingConfig.ts` draws the pricing page and every
// figure a customer reads; `functions/src/index.ts` holds its own literal copy and decides
// what a renewal actually GRANTS. Nothing but discipline keeps them equal, and discipline
// is exactly what a hurried edit skips — the result being a pricing page that promises 300
// tokens and a server that hands out 100, which the customer discovers after paying.
//
// So: they are compared field by field here, and the economic rules the ladder rests on are
// asserted rather than trusted, because each was violated in the shipped config at some
// point and none of them is visible by reading one file.
//
// Runs in `npm run build`. `npm run test:pricing` runs it alone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PRICING_CONFIG as CLIENT } from '../config/pricingConfig';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let failures = 0;
const ok = (cond: boolean, label: string, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

/* ============================================ 1. the two copies agree */

console.log('CLIENT / SERVER AGREEMENT:');

/*
 * The server's copy is read as TEXT rather than imported: `functions/` is a separate
 * package with its own tsconfig and a firebase-functions import that pulls in the Admin
 * SDK, so importing it here would drag a runtime into a build-time check. The literal is
 * what matters anyway — that is the thing that can silently differ.
 */
const serverSrc = fs.readFileSync(path.join(root, 'functions', 'src', 'index.ts'), 'utf8');
const block = (label: string): string => {
  const at = serverSrc.indexOf(label);
  if (at < 0) return '';
  const close = serverSrc.indexOf('\n  },', at);
  return close < 0 ? '' : serverSrc.slice(at, close);
};

const plansBlock = block('  plans: {');
ok(plansBlock.length > 0, 'the server still declares a plans block');

for (const [tier, plan] of Object.entries(CLIENT.plans)) {
  const row = plansBlock.split('\n').find((l) => l.trim().startsWith(`${tier}:`));
  if (!row) { ok(false, `server declares the ${tier} plan`); continue; }
  const num = (key: string): number | null => {
    const m = row.match(new RegExp(`${key}:\\s*(\\d+)`));
    return m ? Number(m[1]) : null;
  };
  ok(num('price') === plan.price,
    `${tier}: price agrees ($${plan.price})`, `server says ${num('price')}`);
  ok(num('monthlyTokens') === plan.monthlyTokens,
    `${tier}: monthly tokens agree (${plan.monthlyTokens})`, `server says ${num('monthlyTokens')}`);
  if (plan.membersPerWorkspace != null) {
    ok(num('membersPerWorkspace') === plan.membersPerWorkspace,
      `${tier}: seats agree (${plan.membersPerWorkspace})`, `server says ${num('membersPerWorkspace')}`);
  }
}

const packsBlock = block('  tokenPacks: [');
for (const pack of CLIENT.tokenPacks) {
  const row = packsBlock.split('\n').find((l) => l.includes(`id: '${pack.id}'`));
  if (!row) { ok(false, `server declares the ${pack.id} pack`); continue; }
  const num = (key: string): number | null => {
    const m = row.match(new RegExp(`${key}:\\s*(\\d+)`));
    return m ? Number(m[1]) : null;
  };
  ok(num('tokens') === pack.tokens && num('price') === pack.price,
    `${pack.id} pack agrees (${pack.tokens} for $${pack.price})`,
    `server says ${num('tokens')} for $${num('price')}`);
}

/* The declaration, not the interface: `expansion: { member: number; … }` also starts that
   way and carries no digits, so the first cut read every field as undefined and reported a
   drift that did not exist. */
const expansionRow = serverSrc.split('\n')
  .find((l) => l.trim().startsWith('expansion: {') && /\d/.test(l)) ?? '';
for (const [key, value] of Object.entries(CLIENT.expansion)) {
  const m = expansionRow.match(new RegExp(`${key}:\\s*(\\d+)`));
  ok(m != null && Number(m[1]) === value,
    `expansion ${key} agrees ($${value})`, `server says ${m?.[1]}`);
}

/* ======================================= 2. the rules the ladder rests on */

console.log('\nLADDER RULES:');

const perToken = (price: number, tokens: number) => price / tokens;
const proRate = perToken(CLIENT.plans.pro.price, CLIENT.plans.pro.monthlyTokens);

/*
 * NO PACK MAY UNDERCUT THE ENTRY PLAN — the config bug this ladder was repriced to fix.
 * At $5/100 a Free user bought tokens at $0.050 while a Pro subscriber paid $0.070, so
 * the rational customer never subscribed at all.
 *
 * THE VOLUME PACKS ARE EXEMPT, AND WHY. A 5,000 or 10,000-token pack costs $300–500 up
 * front and takes well over a year to consume at Pro's monthly rate — nobody buys one
 * INSTEAD of subscribing, and a Free buyer still cannot export what they produce with it.
 * They are a discount to somebody already on Agency or Enterprise, which is what part 15
 * says of the 10,000 pack; the same reasoning covers the 5,000. The small packs get no
 * such exemption: those are exactly what a Free user buys to avoid subscribing, which is
 * the arbitrage the reprice exists to close.
 */
const VOLUME_PACKS = new Set(['agency', 'enterprise']);
for (const pack of CLIENT.tokenPacks) {
  if (VOLUME_PACKS.has(pack.id)) continue;
  const rate = perToken(pack.price, pack.tokens);
  ok(rate >= proRate,
    `${pack.id} pack ($${rate.toFixed(3)}/token) does not undercut Pro ($${proRate.toFixed(3)}/token)`);
}

/* A tier must cost more than the one below it, or the ladder is not a ladder. */
const order: Array<keyof typeof CLIENT.plans> = ['free', 'pro', 'team', 'agency', 'enterprise'];
for (let i = 1; i < order.length; i++) {
  const lower = CLIENT.plans[order[i - 1]!]!;
  const higher = CLIENT.plans[order[i]!]!;
  ok(higher.price > lower.price,
    `${order[i]} ($${higher.price}) costs more than ${order[i - 1]} ($${lower.price})`);
  ok(higher.monthlyTokens >= lower.monthlyTokens,
    `${order[i]} includes at least as many tokens as ${order[i - 1]}`);
}

/*
 * AN EXTRA SEAT MUST NOT BE NEARLY FREE. At $4 against a $49 five-seat plan the sixth
 * seat cost a twelfth of the first, so a Team plan with bolt-on seats was cheaper than
 * Agency for the same headcount and the tier above had nothing to sell.
 */
const teamSeats = CLIENT.plans.team.membersPerWorkspace ?? 1;
const teamPerSeat = CLIENT.plans.team.price / teamSeats;
ok(CLIENT.expansion.member >= teamPerSeat * 0.5,
  `an extra seat ($${CLIENT.expansion.member}) is not trivial beside a bundled one ($${teamPerSeat.toFixed(2)})`);

/*
 * PRO STAYS UNDER THE SUBSTITUTE'S PRICE. The positioning line is "purpose-built, and
 * cheaper than the general-purpose assistant you already pay for" — true only while Pro
 * is below ChatGPT Plus at $20. If that ever stops being true the claim has to go with it.
 */
ok(CLIENT.plans.pro.price < 20,
  `Pro ($${CLIENT.plans.pro.price}) stays under the $20 substitute the positioning names`);

/* ==================================== 3. nothing hardcodes a figure */

console.log('\nNO HARDCODED FIGURES:');

const walk = (dir: string, out: string[] = []): string[] => {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(e.name)) out.push(rel);
  }
  return out;
};
const appFiles = ['pages', 'components'].flatMap((d) => walk(d));

/*
 * The old prices must not survive as literals in copy. This is the QA report's finding
 * ("4 / 200 credits" on the card while the config said otherwise) generalised: any figure
 * a customer reads comes from the config, so repricing is one edit and never a hunt.
 */
const stale: string[] = [];
for (const f of appFiles) {
  const text = fs.readFileSync(path.join(root, f), 'utf8');
  text.split(/\r?\n/).forEach((line, i) => {
    const code = line.replace(/(^|\s)\/\/.*$/, '');
    /* `placeholder="e.g. $49/mo"` on an offer field is the CUSTOMER's price, asked for as
       input. Flagging it would train the reader to ignore this check. */
    if (/placeholder=|example=/.test(code)) return;
    if (/\$7\b|\$49\b|\b100 tokens\b|\b400 tokens\b/.test(code)) stale.push(`${f}:${i + 1}: ${line.trim().slice(0, 90)}`);
  });
}
ok(stale.length === 0, 'no screen hardcodes a price or allowance the config decides', stale.join('\n        '));

console.log(failures === 0
  ? '\nPASS — one ladder, both copies agreeing, and no pack undercutting a plan.'
  : `\nFAILED — ${failures} assertion(s).`);
process.exit(failures === 0 ? 0 : 1);
