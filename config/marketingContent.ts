// Shared marketing copy reused across the FAQ page and homepage FAQ section.

import { DEFAULT_PRICING_CONFIG as CFG } from './pricingConfig';

export interface FaqItem { q: string; a: string; }

// Plan figures are interpolated from the pricing config so published copy cannot advertise numbers
// the product does not deliver.
const FREE_TOKENS = CFG.plans.free.monthlyTokens;
const PRO_TOKENS = CFG.plans.pro.monthlyTokens;
const PRO_PRICE = CFG.plans.pro.price;
const PACK = CFG.tokenPacks[0];

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'What is MarketBrain OS?',
    a: 'MarketBrain OS is the pre-spend review for marketing decisions. Give it a landing page URL, a set of ad variants, an offer or a campaign plan, and it returns a scored report with ranked, specific fixes — so the work is reviewed before the budget is spent. It reviews and explains; it does not predict results, buy media or write your content for you.',
  },
  {
    q: 'How do tokens work?',
    a: `Each analysis consumes tokens. Free accounts get a one-time allowance of ${FREE_TOKENS} tokens that does not replenish; Pro accounts receive ${PRO_TOKENS} tokens every month and can top up at any time. Tokens are only charged when an analysis completes successfully, and failed runs are automatically refunded.`,
  },
  {
    q: 'How much does it cost?',
    a: `The Free plan is $0. Pro is $${PRO_PRICE}/month and includes ${PRO_TOKENS} tokens monthly, every tool, priority support, and token top-ups. Top-ups start at $${PACK.price} for ${PACK.tokens} tokens and never expire.`,
  },
  {
    q: 'What tools are included?',
    a: 'Fourteen tools across five suites — Marketing Intelligence, Sales Intelligence, Business Strategy, Operations Intelligence, and Extras — including Angle Miner, Audience Intelligence, Messaging Analyzer, Offer Analyzer, Conversion Doctor, Strategy Lab, Growth Analyzer, and more. See the Features page for the full list.',
  },
  {
    q: 'Do I need a credit card to start?',
    a: 'No. You can create a free account and run your first analyses without entering any payment details. Upgrade to Pro whenever you are ready.',
  },
  {
    q: 'How is my data handled?',
    a: 'Your analyses are saved privately to your account so you can revisit them from your history. You can delete any saved analysis at any time.',
  },
];
