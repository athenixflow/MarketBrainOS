// Getting Started category — orientation for brand-new users.

import { DocArticle } from './types';

const whatIsIt: DocArticle = {
  id: 'what-is-marketbrain',
  categoryId: 'getting-started',
  title: 'What is MarketBrain OS?',
  summary: 'The predictive intelligence layer for marketing decisions — and what it deliberately is not.',
  keywords: ['overview', 'definition', 'platform', 'intelligence', 'boundaries'],
  blocks: [
    { type: 'heading', id: 'definition', text: 'Definition' },
    { type: 'paragraph', text: 'MarketBrain OS is a **predictive analytics and validation engine** for digital marketing assets. You feed it marketing hypotheses — angles, copy, offers, landing pages, campaigns, strategies — and it returns probabilistic performance scores, diagnostics, and concrete optimization data. Think of it as an always-on strategic consultant that pressure-tests ideas before you spend money on them.' },
    { type: 'paragraph', text: 'It is a **connected intelligence suite**: 13 tools across five suites that share one result format and can feed into each other, so intelligence compounds instead of living in silos.' },
    { type: 'heading', id: 'not', text: 'What it is NOT' },
    { type: 'list', items: [
      'It is **not** a generative content writer for blog posts or articles.',
      'It is **not** a social-media scheduling or automation tool.',
      'It is **not** a financial investment advisor or trading bot.',
      'It does **not** execute media buys or write directly to ad networks — it is decision support, not an ad manager.',
    ] },
    { type: 'callout', tone: 'info', title: 'Who it is for', text: 'Founders, marketers, media buyers, agencies, and enterprise teams who want to validate and sharpen marketing decisions with AI before committing budget.' },
  ],
};

const coreConcepts: DocArticle = {
  id: 'core-concepts',
  categoryId: 'getting-started',
  title: 'Core concepts',
  summary: 'The validation pipeline, scores and verdicts, tokens, scopes, and the connected suite.',
  keywords: ['pipeline', 'score', 'verdict', 'token', 'scope', 'concepts'],
  blocks: [
    { type: 'heading', id: 'pipeline', text: 'The validation pipeline' },
    { type: 'paragraph', text: 'Every analysis moves through the same four phases:' },
    { type: 'steps', items: [
      { title: 'Input', text: 'You provide raw product data, audience, copy, or an asset URL.' },
      { title: 'Processing', text: 'The intelligence core analyzes your input against high-conversion patterns.' },
      { title: 'Scoring', text: 'The system assigns probabilistic scores (0–100) where applicable.' },
      { title: 'Output', text: 'You get actionable findings, rewrites, and diagnostics in a consistent format.' },
    ] },
    { type: 'heading', id: 'scores', text: 'Scores & verdicts' },
    { type: 'paragraph', text: 'Scored tools return an **Intelligence Grade (0–100)** and a short **verdict** badge. The score is a directional signal — the real value is in the Weaknesses, Recommendations, and Action Plan sections that explain the "why" and the "what next".' },
    { type: 'heading', id: 'tokens', text: 'Tokens' },
    { type: 'paragraph', text: 'Running a deep analysis costs **tokens**. You get a monthly allowance with your plan and can buy top-up packs that never expire. See [How tokens work](/documentation/billing/how-tokens-work).' },
    { type: 'heading', id: 'scopes', text: 'Scopes & visibility' },
    { type: 'paragraph', text: 'Work happens in a **scope** — Personal, a Team Workspace, an Agency client, or an Enterprise. Your active scope decides who can see an analysis and whose token wallet pays for it. See [Scopes & visibility](/documentation/organizations/scopes-visibility).' },
  ],
};

const account: DocArticle = {
  id: 'account-and-onboarding',
  categoryId: 'getting-started',
  title: 'Account, sign-in & onboarding',
  summary: 'Create your account, sign in, and get oriented with the first-run walkthrough.',
  keywords: ['sign up', 'sign in', 'google', 'oauth', 'onboarding', 'account'],
  blocks: [
    { type: 'heading', id: 'sign-up', text: 'Creating your account' },
    { type: 'paragraph', text: 'Sign up on the [auth page](/auth) with email and password, or continue with Google. New accounts start on the **Free** plan with a one-time token allowance so you can try the tools immediately.' },
    { type: 'heading', id: 'onboarding', text: 'The first-run walkthrough' },
    { type: 'paragraph', text: 'On your first login, a short onboarding overlay introduces the platform in five steps: welcome, the connected suite, how tokens work, where to find tools, and running your first analysis. You can skip it at any time, or jump straight into a recommended first tool.' },
    { type: 'callout', tone: 'tip', title: 'Start here', text: 'The walkthrough recommends [Strategy Lab](/documentation/tools/strategy-lab) for your first run — it is a fast way to see the full result format.' },
  ],
};

const navigating: DocArticle = {
  id: 'navigating-the-app',
  categoryId: 'getting-started',
  title: 'Navigating the app',
  summary: 'The sidebar suites, dashboard, History, Reports, the scope switcher, and your token badge.',
  keywords: ['sidebar', 'navigation', 'dashboard', 'history', 'reports', 'scope switcher'],
  blocks: [
    { type: 'heading', id: 'sidebar', text: 'The sidebar' },
    { type: 'paragraph', text: 'The left sidebar is your map. It groups everything into: **Core** (Dashboard, History, Reports), the five **analysis-tool suites**, **Collaboration** (Team, Agency, Enterprise — shown when your plan or membership unlocks them), and **Account** (Billing, Settings, Support).' },
    { type: 'heading', id: 'dashboard', text: 'The dashboard' },
    { type: 'paragraph', text: 'Your home hub shows intelligence metrics, your most-used tools, recent activity, a recommended next tool, and quick-action tiles. It is the fastest way to jump back into work.' },
    { type: 'heading', id: 'history-reports', text: 'History & Reports' },
    { type: 'paragraph', text: '[History](/history) keeps every analysis you run — searchable and filterable. [Reports](/reports) is your curated library of saved intelligence, scoped to where you are working.' },
    { type: 'heading', id: 'scope-switcher', text: 'The scope switcher & token badge' },
    { type: 'paragraph', text: 'The header scope switcher moves you between Personal and any team/agency/enterprise you belong to. The sidebar token badge always shows your remaining balance for the current cycle.' },
  ],
};

const firstAnalysis: DocArticle = {
  id: 'first-analysis',
  categoryId: 'getting-started',
  title: 'Run your first analysis',
  summary: 'A complete end-to-end walkthrough, from opening a tool to reading the result.',
  keywords: ['first analysis', 'walkthrough', 'tutorial', 'run', 'quickstart'],
  blocks: [
    { type: 'heading', id: 'walkthrough', text: 'Step by step' },
    { type: 'steps', items: [
      { title: 'Pick a tool', text: 'From the dashboard or sidebar, open [Strategy Lab](/documentation/tools/strategy-lab) (a good first run).' },
      { title: 'Read the header', text: 'Each tool shows its purpose, expected outcomes, estimated time, and token cost before you start.' },
      { title: 'Fill the essentials', text: 'Complete the main input (min 20 characters) and the essential context fields. Be specific.' },
      { title: 'Add context (optional)', text: 'Expand advanced fields, or attach a prior saved analysis if the tool supports it.' },
      { title: 'Run it', text: 'Click the CTA button — it shows the exact token cost. Results usually arrive in 30–60 seconds and save automatically.' },
      { title: 'Read & act', text: 'Skim the Executive Summary, then work through Recommendations and the Action Plan. Export or share as needed.' },
    ] },
    { type: 'callout', tone: 'tip', title: 'Next step', text: 'Once you have one analysis saved, try chaining it into another tool — see [Chaining analyses](/documentation/tools/chaining).' },
  ],
};

export const gettingStartedArticles: DocArticle[] = [
  whatIsIt, coreConcepts, account, navigating, firstAnalysis,
];
