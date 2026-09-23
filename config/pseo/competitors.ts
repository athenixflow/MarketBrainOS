/**
 * COMPARISON PAGE DATA (GTM part 10 §4.2, DO-NEXT #15).
 *
 * THE HONESTY MACHINERY IS THE POINT. A "vs" page is the most tempting place in a product
 * to shade the truth: the reader is deciding, the competitor is not in the room, and every
 * claim is about somebody else's product. Three rules are enforced by the shape of this
 * file rather than by good intentions:
 *
 *   `verifiedOn` IS REQUIRED TO PUBLISH. A page whose data was last checked more than
 *   `VERIFY_WINDOW_DAYS` ago — or never — does not enter the sitemap and renders a banner
 *   saying it is being re-verified. Competitor pricing changes without notice, and a stale
 *   comparison is a false claim with a date on it.
 *
 *   NULL MEANS "NOT PUBLICLY AVAILABLE", NOT ZERO. Every plan field is nullable and renders
 *   as a link to the competitor's own pricing page. Guessing is how a comparison becomes
 *   defamatory.
 *
 *   `strengths` COMES FIRST AND MUST BE REAL. Each page states what the competitor is
 *   genuinely better at before it argues anything. A comparison with no such section is
 *   an advertisement wearing a table.
 *
 * NOTHING HERE HAS BEEN VERIFIED BY THE AUTHOR OF THIS FILE. `verifiedOn` is null on every
 * entry, so no page publishes yet. Filling it in means opening the competitor's pricing
 * page in a browser, correcting what is wrong, and dating it — see `docs/gtm/parts/10`.
 */

export const VERIFY_WINDOW_DAYS = 90;

/** The fixed row list, so two pages cannot compare different things (part 10 §4.2). */
export const CAPABILITY_ROWS = [
  'Reads a live URL you give it',
  'Returns the same sections every time',
  'Scores the work 0–100',
  'Keeps a searchable history of results',
  'Exports a branded PDF for a client',
  'Built specifically for marketing decisions',
] as const;

export type Capability = 'yes' | 'no' | 'partial' | 'unknown';

export interface CompetitorPlan {
  name: string;
  /** USD per month. Null renders as "Not publicly available" with a link. */
  monthlyUsd: number | null;
  note?: string;
}

export interface Competitor {
  slug: string;
  name: string;
  /** The page a reader should check for themselves. Always shown. */
  pricingUrl: string;
  /** ISO date the plan data was last checked in a browser. Null = never; page stays unpublished. */
  verifiedOn: string | null;
  /** What they are genuinely better at. Rendered before any argument for us. */
  strengths: string[];
  plans: CompetitorPlan[];
  /** Keyed to CAPABILITY_ROWS, same order. 'unknown' is honest and renders as such. */
  capabilities: Capability[];
  /** Ours, for the same rows — stated from what the product actually does. */
  faq: Array<{ q: string; a: string }>;
}

/**
 * OUR OWN COLUMN, written from the code rather than from the marketing site.
 *
 * Every entry is something this repository demonstrably does: Conversion Doctor fetches a
 * URL through `fetchPage.ts`; results are stored in `tool_analysis_results` and listed in
 * History; the PDF export is `services/pdfReport.ts`, gated to paid tiers. If a row here
 * ever stops being true, this file is the lie, not the product.
 */
export const OURS: Capability[] = ['yes', 'yes', 'yes', 'yes', 'yes', 'yes'];

export const COMPETITORS: Competitor[] = [
  {
    slug: 'chatgpt',
    name: 'ChatGPT',
    pricingUrl: 'https://openai.com/chatgpt/pricing',
    /* NOT VERIFIED. Plan prices change; this publishes only once somebody has checked. */
    verifiedOn: null,
    strengths: [
      'It does almost everything, and it is probably already open in another tab.',
      'It will argue back, change direction mid-conversation and write the copy as well as critique it.',
      'A single subscription covers every task, not just marketing ones.',
    ],
    plans: [
      { name: 'Free', monthlyUsd: null },
      { name: 'Plus', monthlyUsd: null },
      { name: 'Team', monthlyUsd: null, note: 'per seat' },
    ],
    /* 'unknown' until somebody checks each one against the live product. */
    capabilities: ['unknown', 'unknown', 'unknown', 'unknown', 'unknown', 'no'],
    faq: [
      {
        q: 'Is this a different AI model?',
        a: 'No, and it would be dishonest to imply it. MarketBrain OS runs on Google’s Gemini 2.5 Pro — the same class of model. The difference is what surrounds it: a fixed result format, a live page fetch, a saved history and the same structure for everybody on a team.',
      },
      {
        q: 'So why not just paste my page into a chat window?',
        a: 'You can, and for a one-off it may be enough. The difference shows up on the fifth page: chat answers are shaped differently every time, so you cannot compare Tuesday to Thursday, and nothing is saved where a colleague can find it.',
      },
      {
        q: 'Which should I use?',
        a: 'Most people use both. A general assistant is better for drafting and for thinking out loud; a review step is better when a decision needs the same treatment every time and a record afterwards.',
      },
      {
        q: 'Is my data used for training?',
        a: 'Analyses run through the Google Gemini API. See our privacy policy for what we store and for how long. For what any other provider does with your inputs, read their own policy rather than our summary of it.',
      },
      {
        q: 'What does it cost to try?',
        a: 'The free account includes a one-time token allowance, and the landing-page scorer runs without an account at all.',
      },
    ],
  },
  {
    slug: 'claude',
    name: 'Claude',
    pricingUrl: 'https://www.anthropic.com/pricing',
    verifiedOn: null,
    strengths: [
      'Long documents: it will hold a whole brand guide or a research deck in context and reason across it.',
      'Careful, qualified writing — it hedges where a claim is uncertain rather than asserting it.',
      'Strong at editing and critiquing prose you already have.',
    ],
    plans: [
      { name: 'Free', monthlyUsd: null },
      { name: 'Pro', monthlyUsd: null },
      { name: 'Team', monthlyUsd: null, note: 'per seat' },
    ],
    capabilities: ['unknown', 'unknown', 'unknown', 'unknown', 'unknown', 'no'],
    faq: [
      {
        q: 'Is Claude better at writing than this?',
        a: 'For drafting and editing long prose, very likely. MarketBrain OS is not a writing tool — it reviews work that already exists and returns a score with ranked fixes.',
      },
      {
        q: 'Can Claude audit a landing page?',
        a: 'It can read a page you paste, and with browsing it can fetch one. What it does not do is return the same sections and the same 0–100 scale every time, which is what makes two audits comparable.',
      },
      {
        q: 'Do you use Claude?',
        a: 'No — MarketBrain OS runs on Google’s Gemini 2.5 Pro.',
      },
      {
        q: 'Can I use both?',
        a: 'Yes, and it is a reasonable combination: draft in a general assistant, review before you spend.',
      },
      {
        q: 'What is the smallest way to compare them?',
        a: 'Take one landing page, run it through both, and look at which output you could hand to a client unchanged.',
      },
    ],
  },
  {
    slug: 'gemini',
    name: 'Gemini',
    pricingUrl: 'https://one.google.com/about/google-ai-plans/',
    verifiedOn: null,
    strengths: [
      'The same model family this product is built on, available directly and often for less.',
      'Deep integration with Google Docs, Sheets and Gmail, where marketing work already lives.',
      'Generous free access compared with most assistants.',
    ],
    plans: [
      { name: 'Free', monthlyUsd: null },
      { name: 'Google AI Pro', monthlyUsd: null },
    ],
    capabilities: ['unknown', 'unknown', 'unknown', 'unknown', 'unknown', 'no'],
    faq: [
      {
        q: 'Does MarketBrain OS run on Gemini?',
        a: 'Yes. It calls Google’s Gemini 2.5 Pro. Any page that implied a proprietary model would be lying, and this one says it plainly: the model is the same, the product around it is not.',
      },
      {
        q: 'Then why pay for this instead of using Gemini directly?',
        a: 'Because the model is the cheap part. What you are paying for is the fixed result format, the live page fetch with its own guards, the saved and searchable history, the client-ready export, and the fact that everybody on a team gets the same shape of answer.',
      },
      {
        q: 'Could I rebuild this with prompts?',
        a: 'A good prompt gets you one good answer. Keeping that answer identical in structure across fifty runs, six months and three colleagues is the work, and it is what this is.',
      },
      {
        q: 'Which model version?',
        a: 'Gemini 2.5 Pro for the full analyses, and a Flash-class model for the free public scorer where speed matters more than depth.',
      },
      {
        q: 'Is Gemini better value?',
        a: 'If you want a general assistant, very possibly. Compare the job to be done rather than the price: they are not the same product.',
      },
    ],
  },
];

/** Publishable = verified inside the window. Everything else stays out of the sitemap. */
export const isPublishable = (c: Competitor, now: Date = new Date()): boolean => {
  if (!c.verifiedOn) return false;
  const checked = Date.parse(c.verifiedOn);
  if (!Number.isFinite(checked)) return false;
  return now.getTime() - checked <= VERIFY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
};
