/**
 * THE FIRST RUN, PREFILLED (GTM part 03 §4, experiment E03).
 *
 * The old overlay was five screens explaining the product, and the last one said "try a
 * tool". Everything a new person had to do to feel any value came AFTER the explanation
 * ended: pick a tool, work out what it wanted, write a brief, and only then see a result.
 * The measured cost of that is the gap between signup and the first `analysis_completed`.
 *
 * So the overlay now asks one question — what are you deciding? — and each answer lands on
 * a tool with every field already filled in. The model call is about 55 seconds; the rest
 * of "time to value" was form-filling, and this removes it.
 *
 * THE INPUTS ARE EXAMPLES, AND THE PRODUCT SAYS SO. Somebody who runs one of these
 * unchanged gets a real audit of a fictional company, which is worth exactly as much as
 * that sounds. The value is in seeing the SHAPE of a result and the shape of a good input;
 * the tool page shows a visible notice saying so, with one control to clear the fields.
 * Prefilling silently and letting somebody spend four tokens discovering it is the version
 * of this feature that would deserve to be removed.
 *
 * NO THIRD-PARTY URLS. Conversion Doctor accepts a live URL, and it would be easy to
 * prefill a famous SaaS pricing page. We are not going to point a fleet of new accounts at
 * somebody else's site, publish a score for it, and call it onboarding — so the example is
 * pasted copy, self-contained and obviously invented.
 */

import { TOKEN_COSTS } from '../types';

export interface OnboardingExample {
  id: string;
  /** The decision, in the user's words — not the tool's name. */
  title: string;
  blurb: string;
  /** Where it lands, and what that costs. */
  path: string;
  toolLabel: string;
  cost: number;
  /**
   * Field values, keyed exactly as the destination names them: `config.inputs[].key` for a
   * generic tool, or the bespoke page's own state keys. A key that matches nothing is a
   * card that silently prefills less than it promises, which `scripts/onboarding.test.ts`
   * exists to catch.
   */
  prefill: Record<string, string>;
}

export const ONBOARDING_EXAMPLES: OnboardingExample[] = [
  {
    id: 'saas-pricing-page',
    title: 'A page that gets traffic and no signups',
    blurb: 'Audit the copy for what is costing conversions, ranked, with a rewrite for each.',
    path: '/conversion-doctor',
    toolLabel: 'Conversion Doctor',
    cost: TOKEN_COSTS.ConversionDoctor,
    prefill: {
      context: 'Landing Page',
      audience: 'Agency owners with 3-10 staff, arriving cold from a LinkedIn post',
      goal: 'Start a 14-day free trial',
      input: [
        'Pricing that scales with you',
        '',
        'Starter — $29/month. Everything you need to get going. Up to 3 projects, 5GB storage, email support.',
        'Professional — $99/month. Our most popular plan. Unlimited projects, 100GB storage, priority support, advanced analytics.',
        'Enterprise — Contact us. Custom limits, SSO, dedicated account manager, SLA.',
        '',
        'All plans include a 14-day free trial. No credit card required. Cancel anytime.',
        '',
        'Trusted by teams at leading companies worldwide. Join thousands of happy customers who have transformed the way they work.',
        '',
        'Frequently asked questions',
        'Can I change plans later? Yes, you can upgrade or downgrade at any time.',
        'Do you offer refunds? Contact our support team and we will do our best to help.',
        '',
        'Ready to get started? Sign up today.',
      ].join('\n'),
    },
  },
  {
    id: 'ecommerce-offer',
    title: 'An offer I am about to launch',
    blurb: 'Pressure-test the price, the bonuses and the guarantee before anyone sees them.',
    path: '/offer-analyzer',
    toolLabel: 'Offer Analyzer',
    cost: TOKEN_COSTS.OfferAnalyzer,
    prefill: {
      offer: 'A 12-week skincare subscription box: three full-size products a month, chosen by a quiz, with a monthly routine card written for the customer\'s skin type.',
      pricing: '$49/month, or $129 for three months paid upfront. Free shipping over $40.',
      bonuses: 'First box ships with a reusable travel case. Subscribers get early access to new products and a private community.',
      guarantees: '30-day money-back guarantee on the first box. Pause or cancel any time.',
      audience: 'Women aged 28-45 who already spend $60-100 a month on skincare and are tired of guessing what works.',
      competingOffers: 'Birchbox-style sample boxes at $15-20, direct-from-brand subscriptions at $35-60, and doing nothing — buying the same two products on repeat.',
    },
  },
  {
    id: 'b2b-campaign',
    title: 'A campaign plan, before I spend on it',
    blurb: 'Check the plan holds together — audience, channels, budget and goal — while it is still cheap to change.',
    path: '/campaign-analyzer',
    toolLabel: 'Campaign Analyzer',
    cost: TOKEN_COSTS.Campaign,
    prefill: {
      campaign: 'Launch a new reporting feature to existing customers and cold B2B prospects at the same time: a webinar, a three-email sequence, LinkedIn ads to a lookalike audience, and a comparison page against the two incumbent tools.',
      goals: 'Book 40 demos in six weeks and convert 12 of them. Secondary: 200 webinar registrations.',
      audience: 'Heads of marketing at 50-500 person B2B software companies who currently export reports to spreadsheets by hand.',
      channels: 'LinkedIn ads, email to the existing list, a live webinar, organic LinkedIn posts from the founder.',
      budget: '$8,000 total: $5,000 ads, $1,500 webinar production, $1,500 contingency.',
      timeframe: '6 weeks',
    },
  },
];

/** Looked up by the destination page from router state. */
export const findExample = (id: string | undefined): OnboardingExample | undefined =>
  ONBOARDING_EXAMPLES.find((e) => e.id === id);
