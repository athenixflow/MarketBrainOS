// Reference category — quick-lookup material: token costs, glossary, boundaries, limits, support.

import { DocArticle } from './types';

const tokenCosts: DocArticle = {
  id: 'token-costs',
  categoryId: 'reference',
  title: 'Token cost table',
  summary: 'The exact token cost of every analysis tool, at a glance.',
  keywords: ['cost', 'token', 'price', 'table', 'reference'],
  blocks: [
    { type: 'heading', id: 'table', text: 'Cost per run' },
    { type: 'table', headers: ['Tool', 'Suite', 'Tokens'], align: ['left', 'left', 'right'], rows: [
      ['Angle Miner', 'Marketing Intelligence', '3'],
      ['Messaging Analyzer', 'Marketing Intelligence', '3'],
      ['Audience Intelligence', 'Marketing Intelligence', '4'],
      ['Market Intelligence', 'Marketing Intelligence', '5'],
      ['Competitor Analyzer', 'Marketing Intelligence', '4'],
      ['Content Strategy', 'Marketing Intelligence', '4'],
      ['Campaign Analyzer', 'Marketing Intelligence', '4'],
      ['Conversion Doctor', 'Sales Intelligence', '4'],
      ['Offer Analyzer', 'Sales Intelligence', '4'],
      ['Strategy Lab', 'Business Strategy', '5'],
      ['Growth Analyzer', 'Business Strategy', '5'],
      ['Workflow Analyzer', 'Operations Intelligence', '5'],
      ['TestLab Pro', 'Extras', '5'],
      ['Workflow Pipeline', 'Extras', '6'],
    ] },
    { type: 'callout', tone: 'info', title: 'Failed runs are free', text: 'If an analysis fails, the tokens are refunded automatically to the exact buckets they came from.' },
  ],
};

const glossary: DocArticle = {
  id: 'glossary',
  categoryId: 'reference',
  title: 'Glossary',
  summary: 'Plain definitions for the terms used across MarketBrain OS.',
  keywords: ['glossary', 'definitions', 'terms', 'vocabulary'],
  blocks: [
    { type: 'heading', id: 'terms', text: 'Key terms' },
    { type: 'table', headers: ['Term', 'Meaning'], rows: [
      ['Intelligence Grade (score)', 'A 0–100 rating a scored tool assigns to your asset — a directional signal, not a verdict.'],
      ['Verdict', 'A short decision-label badge summarizing a scored result.'],
      ['Monthly tokens', 'Plan-included tokens that reset each billing cycle.'],
      ['Purchased tokens', 'Top-up tokens bought in packs; they never expire.'],
      ['Scope', 'The context you work in (Personal / Team / Client / Enterprise) — sets visibility and who pays.'],
      ['Container', 'A Team Workspace, Agency, or Enterprise — the org units that hold members and analyses.'],
      ['Allocation', 'A per-cycle token cap set on a client, member, or agency out of a shared pool.'],
      ['Expansion', 'A paid add-on that raises a capacity limit (seats, workspaces, agencies).'],
      ['Universal sections', 'The fixed set of result sections every generic analysis returns.'],
    ] },
  ],
};

const boundaries: DocArticle = {
  id: 'limits-boundaries',
  categoryId: 'reference',
  title: 'Limits & boundaries',
  summary: 'Input limits, what the platform will not do, and other operating boundaries.',
  keywords: ['limit', 'boundary', 'input', 'minimum', 'maximum', 'constraints'],
  blocks: [
    { type: 'heading', id: 'input', text: 'Input limits' },
    { type: 'list', items: [
      'The main input of any tool must be **at least 20 characters** — shorter inputs are blocked for quality.',
      'Very long inputs are rejected with "Input is too long. Please consolidate." Long fields show a live character counter.',
    ] },
    { type: 'heading', id: 'not', text: 'Platform boundaries' },
    { type: 'list', items: [
      'Not a generative long-form content writer.',
      'Not a scheduling or automation tool.',
      'Not a financial/investment advisor.',
      'Does not execute media buys or write to ad networks.',
    ] },
    { type: 'callout', tone: 'info', title: 'Decision support', text: 'MarketBrain OS is standalone decision support — it informs your marketing choices; it does not act on external platforms for you.' },
  ],
};

const support: DocArticle = {
  id: 'support-contact',
  categoryId: 'reference',
  title: 'Support & contact',
  summary: 'Where to get help — docs, FAQ, and how to reach the team.',
  keywords: ['support', 'contact', 'help', 'email', 'faq'],
  blocks: [
    { type: 'heading', id: 'channels', text: 'Getting help' },
    { type: 'paragraph', text: 'Start with these docs or the [FAQ](/faq) for quick answers on plans, tokens, and analyses. The in-app [Support page](/support) links to both.' },
    { type: 'heading', id: 'email', text: 'Email the team' },
    { type: 'paragraph', text: 'Still stuck? Email **support@marketbrainos.app** with your account email and a description of what you are trying to do, and the team will help.' },
  ],
};

export const referenceArticles: DocArticle[] = [tokenCosts, glossary, boundaries, support];
