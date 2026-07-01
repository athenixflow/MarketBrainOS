// Tokens, Plans & Billing category. Numbers mirror config/pricingConfig.ts (DEFAULT_PRICING_CONFIG,
// PLAN_META) and types.ts TOKEN_COSTS — the live pricing_config/global doc overrides at runtime.

import { DocArticle } from './types';
import { DEFAULT_PRICING_CONFIG, PLAN_META, PLAN_ORDER, Tier } from '../pricingConfig';

const cfg = DEFAULT_PRICING_CONFIG;
const money = (n: number) => (n === 0 ? '$0' : `$${n}`);

const planCapacity = (t: Tier): string => {
  const p = cfg.plans[t];
  const bits: string[] = [];
  if (p.workspaces) bits.push(`${p.workspaces} workspaces`);
  if (p.agencies) bits.push(`${p.agencies} agencies`);
  if (p.workspacesPerAgency) bits.push(`${p.workspacesPerAgency} workspaces/agency`);
  if (p.maxMembers) bits.push(`up to ${p.maxMembers} members`);
  else if (p.membersPerWorkspace) bits.push(`${p.membersPerWorkspace} members`);
  else bits.push('1 user');
  return bits.join(', ');
};

const howTokens: DocArticle = {
  id: 'how-tokens-work',
  categoryId: 'billing',
  title: 'How tokens work',
  summary: 'Monthly vs purchased tokens, the spend order, resets, and what each tool costs.',
  keywords: ['token', 'monthly', 'purchased', 'reset', 'cost', 'balance', 'allowance'],
  blocks: [
    { type: 'heading', id: 'two-buckets', text: 'Two kinds of tokens' },
    { type: 'paragraph', text: 'Your balance is split into two buckets:' },
    { type: 'list', items: [
      '**Monthly tokens** — included with your plan; they **reset every cycle** (about every 30 days).',
      '**Purchased tokens** — bought as top-up packs; they **never expire** and roll over indefinitely.',
    ] },
    { type: 'paragraph', text: 'Your total balance is simply monthly + purchased. Analyses **spend monthly tokens first**, then dip into purchased tokens only once the monthly allowance is used up — so your never-expiring tokens are preserved as long as possible.' },
    { type: 'heading', id: 'resets', text: 'Resets' },
    { type: 'paragraph', text: 'Monthly tokens refresh to your plan\'s allowance at the start of each billing cycle (see your renewal date in the [Billing Center](/documentation/billing/billing-center)). Purchased tokens are untouched by resets.' },
    { type: 'heading', id: 'costs', text: 'What each tool costs' },
    { type: 'paragraph', text: 'Costs are per run and range from 3 to 6 tokens. If a run fails, the exact tokens are automatically refunded.' },
    { type: 'table', headers: ['Tool', 'Tokens'], rows: [
      ['Angle Miner (generate)', '3'],
      ['Messaging Analyzer', '3'],
      ['Audience Intelligence', '4'],
      ['Competitor Analyzer', '4'],
      ['Content Strategy', '4'],
      ['Campaign Analyzer', '4'],
      ['Offer Analyzer', '4'],
      ['Conversion Doctor', '4'],
      ['Market Intelligence', '5'],
      ['Strategy Lab', '5'],
      ['Growth Analyzer', '5'],
      ['Workflow Analyzer', '5'],
      ['TestLab Pro', '5'],
      ['Workflow Pipeline', '6'],
    ] },
    { type: 'callout', tone: 'info', title: 'Running low?', text: 'Buy a top-up pack in the [Token Store](/documentation/billing/token-store) or move to a higher plan for a bigger monthly allowance.' },
  ],
};

const plans: DocArticle = {
  id: 'plans-compared',
  categoryId: 'billing',
  title: 'Plans compared',
  summary: 'Free, Pro, Team, Agency, and Enterprise — price, monthly tokens, capacity, and features.',
  keywords: ['plan', 'pricing', 'free', 'pro', 'team', 'agency', 'enterprise', 'tier', 'compare'],
  blocks: [
    { type: 'heading', id: 'ladder', text: 'The plan ladder' },
    { type: 'paragraph', text: 'Five plans scale from a solo free account to a multi-agency enterprise. Every plan includes a monthly token allowance; higher plans unlock collaboration layers and larger capacity.' },
    { type: 'table', headers: ['Plan', 'Price / mo', 'Monthly tokens', 'Capacity'], rows: PLAN_ORDER.map((t) => [
      PLAN_META[t].name,
      money(cfg.plans[t].price),
      String(cfg.plans[t].monthlyTokens),
      planCapacity(t),
    ]) },
    { type: 'heading', id: 'features', text: 'What each plan is for' },
    ...PLAN_ORDER.map((t) => ({
      type: 'callout' as const,
      tone: 'info' as const,
      title: `${PLAN_META[t].name} — ${PLAN_META[t].tagline}`,
      text: PLAN_META[t].features.join(' · '),
    })),
    { type: 'callout', tone: 'tip', title: 'Change anytime', text: 'See [Upgrading & changing plans](/documentation/billing/upgrading) for how upgrades apply.' },
  ],
};

const tokenStore: DocArticle = {
  id: 'token-store',
  categoryId: 'billing',
  title: 'Token Store',
  summary: 'Buy top-up packs that never expire, straight from /store.',
  keywords: ['store', 'pack', 'buy', 'top up', 'purchase', 'credits'],
  blocks: [
    { type: 'heading', id: 'packs', text: 'Top-up packs' },
    { type: 'paragraph', text: 'The [Token Store](/store) sells one-time packs. Purchased tokens **never expire** and stack on top of your monthly allowance.' },
    { type: 'table', headers: ['Pack', 'Tokens', 'Price'], rows: cfg.tokenPacks.map((p) => [p.label, String(p.tokens), money(p.price)]) },
    { type: 'heading', id: 'buying', text: 'Buying tokens' },
    { type: 'paragraph', text: 'Open the Token Store, choose a pack, and confirm. The tokens are credited instantly and you get a confirmation plus a notification. You can also reach the store from inside the [Billing Center](/documentation/billing/billing-center).' },
    { type: 'callout', tone: 'warning', title: 'Paid plans only', text: 'Token packs are available on Pro and above. On the Free plan the Buy button is disabled with a prompt to upgrade first.' },
  ],
};

const billingCenter: DocArticle = {
  id: 'billing-center',
  categoryId: 'billing',
  title: 'Billing Center',
  summary: 'Your plan, renewal date, balance breakdown, expansions, and downloadable invoices.',
  keywords: ['billing', 'invoice', 'renewal', 'balance', 'expansion', 'payments', 'csv'],
  blocks: [
    { type: 'heading', id: 'overview', text: 'What the Billing Center shows' },
    { type: 'paragraph', text: 'The [Billing Center](/billing) is your single financial view. It brings together:' },
    { type: 'list', items: [
      '**Current plan** — name, monthly price, and your next renewal date.',
      '**Token balance** — the split of total, monthly (resets), and purchased (never expire).',
      '**Token Store** — buy packs without leaving the page.',
      '**Expansions** — any capacity add-ons you have bought and their recurring cost.',
      '**Invoices** — every payment (subscriptions, packs, expansions), newest first, exportable to CSV.',
    ] },
    { type: 'heading', id: 'invoices', text: 'Invoices & export' },
    { type: 'paragraph', text: 'Each invoice row shows the date, a label (subscription, token pack, or expansion), any tokens credited, and the amount paid. Use **Export CSV** to download the full ledger for your records.' },
    { type: 'callout', tone: 'info', title: 'Reset rule', text: 'Monthly tokens reset each billing cycle; purchased tokens roll over and never expire.' },
  ],
};

const upgrading: DocArticle = {
  id: 'upgrading',
  categoryId: 'billing',
  title: 'Upgrading & changing plans',
  summary: 'How upgrades apply — instant for Pro, container-based for Team/Agency/Enterprise.',
  keywords: ['upgrade', 'downgrade', 'change plan', 'subscribe', 'checkout'],
  blocks: [
    { type: 'heading', id: 'how', text: 'How upgrades work' },
    { type: 'paragraph', text: 'Start from the [Pricing page](/pricing) and pick a plan:' },
    { type: 'list', items: [
      '**Free → Pro** applies immediately — you are upgraded and your allowance jumps to the Pro level.',
      '**Pro → Team / Agency / Enterprise** happens by creating the corresponding container. Creating a Team Workspace, an Agency, or an Enterprise auto-upgrades your plan to match.',
    ] },
    { type: 'paragraph', text: 'After an upgrade you land back on your dashboard with the new capabilities unlocked in the sidebar.' },
    { type: 'callout', tone: 'info', title: 'Simulated payments', text: 'Payments in this environment are simulated and apply instantly — every purchase records an invoice and grants access right away.' },
  ],
};

const expansions: DocArticle = {
  id: 'capacity-expansions',
  categoryId: 'billing',
  title: 'Capacity & expansions',
  summary: 'Buy extra seats, workspaces, or agencies on top of your plan\'s base capacity.',
  keywords: ['expansion', 'capacity', 'seat', 'workspace', 'agency', 'add-on', 'limit'],
  blocks: [
    { type: 'heading', id: 'base', text: 'Base capacity + paid expansions' },
    { type: 'paragraph', text: 'Each plan includes base capacity (members, workspaces, agencies). When you hit a limit, the container owner can buy an expansion from the capacity panel — the effective limit becomes the plan base plus everything purchased.' },
    { type: 'table', headers: ['Expansion', 'Applies to', 'Price / mo'], rows: [
      ['Extra member seat', 'Team, Agency, or Enterprise', money(cfg.expansion.member)],
      ['Extra workspace (client)', 'Agency', money(cfg.expansion.workspace)],
      ['Extra agency', 'Enterprise', money(cfg.expansion.agency)],
    ] },
    { type: 'callout', tone: 'tip', title: 'Owner only', text: 'Only the container owner can purchase expansions. They apply immediately and appear in the Billing Center under expansions.' },
  ],
};

export const billingArticles: DocArticle[] = [
  howTokens, plans, tokenStore, billingCenter, upgrading, expansions,
];
