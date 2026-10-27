/**
 * Creates the three USD monthly products in a Bachs environment, idempotently (spec §3), and the
 * one-off products for naira passes and token packs (one per currency).
 *
 *   npx tsx scripts/bachs/setup.ts            # uses BACHS_SECRET_KEY from functions/.secret.local
 *   npx tsx scripts/bachs/setup.ts --write    # also writes BACHS_PRODUCT_* into functions/.env
 *
 * A product is matched by `metadata.mb_key` (e.g. "plan_pro_usd_monthly"), so re-running finds
 * the existing one instead of creating a duplicate. Prices come from the pricing config — the
 * same numbers the catalog charges — never typed here.
 *
 * NOT IN THE BUILD: it talks to Bachs. A live key (sk_live_) is refused unless --live is passed,
 * which is for rollout step 4 only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PRICING_CONFIG as CFG } from '../../config/pricingConfig';
import { PAID_TIERS, catalogItem, toMajorString, type Currency } from '../../functions/src/bachs/catalog';
import { productEnvKey } from '../../functions/src/bachs/config';
import { bachsApi } from '../../functions/src/bachs/api';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readKey = (file: string, name: string): string => {
  const p = path.join(root, 'functions', file);
  if (!fs.existsSync(p)) return '';
  const line = fs.readFileSync(p, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return (line?.slice(name.length + 1) ?? '').trim().replace(/^["']|["']$/g, '');
};

const key = process.env.BACHS_SECRET_KEY || readKey('.secret.local', 'BACHS_SECRET_KEY');
if (!key) { console.error('No BACHS_SECRET_KEY in the environment or functions/.secret.local'); process.exit(1); }
const live = key.startsWith('sk_live_');
console.log(`Environment: ${live ? 'LIVE' : 'sandbox'}`);
if (live && !process.argv.includes('--live')) {
  console.error('Refusing to touch the live environment without --live (rollout step 4 only).');
  process.exit(1);
}

const api = bachsApi(key);
const existing = (await api.listProducts()) as Array<Record<string, any>>;
const ids: Record<string, string> = {};

for (const tier of PAID_TIERS) {
  const item = catalogItem(CFG, 'plan', tier, 'USD');
  if (!item) throw new Error(`no USD price for ${tier}`);
  const mbKey = `plan_${tier}_usd_monthly`;
  const found = existing.find((p) => p?.metadata?.mb_key === mbKey);
  if (found) {
    ids[tier] = String(found.id);
    console.log(`${tier}: exists ${found.id}`);
    continue;
  }
  const created = await api.createProduct({
    name: `MarketBrain OS ${tier.charAt(0).toUpperCase()}${tier.slice(1)}`,
    description: `${item.tokens} tokens a month`,
    price: { currency: 'USD', amount: toMajorString(item.amountMinor), price_type: 'fixed' },
    billing_cycle: { interval: 'month', frequency: 1 },
    metadata: { mb_key: mbKey },
  }, `setup_${mbKey}`);
  ids[tier] = String(created.id);
  console.log(`${tier}: created ${created.id}`);
}

/* One-off products for the naira passes and the token packs (M5), so the hosted page names the purchase
   instead of "Payment". One product per currency (see productForItem). The key carries the amount, so a
   price changed in code makes a new product rather than charging the old one: the webhook would refuse
   the mismatch, but the buyer would already have paid the wrong figure. */
const oneOffs: Array<{ kind: 'pass' | 'pack'; item: string; currency: Currency }> = [
  ...PAID_TIERS.map((t) => ({ kind: 'pass' as const, item: t, currency: 'NGN' as Currency })),
  ...CFG.tokenPacks.flatMap((p) => (['USD', 'NGN'] as Currency[]).map((currency) => ({ kind: 'pack' as const, item: p.id, currency }))),
];
const oneOffLines: string[] = [];
for (const o of oneOffs) {
  const item = catalogItem(CFG, o.kind, o.item, o.currency);
  if (!item) { console.log(`${o.kind} ${o.item} ${o.currency}: not for sale, skipped`); continue; }
  const mbKey = `${o.kind}_${o.item}_${o.currency}_${item.amountMinor}`.toLowerCase();
  let id = existing.find((p) => p?.metadata?.mb_key === mbKey)?.id;
  if (id) console.log(`${mbKey}: exists ${id}`);
  else {
    const created = await api.createProduct({
      name: o.kind === 'pack' ? `MarketBrain OS ${item.label}` : `MarketBrain OS ${item.label.replace(', 30 days', '')} pass`,
      description: o.kind === 'pack' ? `${item.tokens.toLocaleString('en-US')} tokens, added to your balance` : `${item.tokens.toLocaleString('en-US')} tokens a month for 30 days`,
      price: { currency: o.currency, amount: toMajorString(item.amountMinor), price_type: 'fixed' },
      metadata: { mb_key: mbKey },
    }, `setup_${mbKey}`);
    id = created.id;
    console.log(`${mbKey}: created ${id}`);
  }
  oneOffLines.push(`${productEnvKey(o.kind, o.item, o.currency)}=${id}`);
}

const lines = [...PAID_TIERS.map((t) => `BACHS_PRODUCT_${t.toUpperCase()}=${ids[t]}`), ...oneOffLines];
console.log('\n' + lines.join('\n'));
if (process.argv.includes('--write')) {
  const envPath = path.join(root, 'functions', '.env');
  // Keep every other line exactly as it is (comments and blank separators included); only the three
  // product lines are replaced, appended after the last non-blank line.
  const current = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  /* functions/.env is what gets deployed. A sandbox run once replaced the live plan ids there with
     sandbox ones, which would have broken every live checkout. A different id is never overwritten
     silently: that is a different environment, so it needs --replace. */
  const clashes = lines.filter((l) => { const [k] = l.split('='); const old = current.find((c) => c.startsWith(`${k}=`)); return old && old !== l; });
  if (clashes.length && !process.argv.includes('--replace')) {
    console.error(`Refusing to write: ${clashes.length} product id(s) in functions/.env differ (another environment?). Pass --replace if that is intended.`);
    process.exit(1);
  }
  const kept = current.filter((l) => !l.startsWith('BACHS_PRODUCT_'));
  while (kept.length && !kept[kept.length - 1].trim()) kept.pop();
  fs.writeFileSync(envPath, [...kept, ...lines].join('\n') + '\n');
  console.log('written to functions/.env');
}
