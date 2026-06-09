import { TOKEN_COSTS } from '../types';

// Canonical universal result sections (PRD §23 / V1 Tool Architecture).
// `summary` on ToolAnalysisResult carries the Executive Summary; these eight
// follow it in this exact order for every generic analysis tool.
export const UNIVERSAL_RESULT_SECTIONS = [
  'Key Findings',
  'Strengths',
  'Weaknesses',
  'Opportunities',
  'Risks',
  'Recommendations',
  'Action Plan',
  'Next Steps',
];

// Suites group tools in the sidebar and dashboard (V1 Tool Architecture).
export type Suite =
  | 'Marketing Intelligence'
  | 'Sales Intelligence'
  | 'Business Strategy'
  | 'Operations Intelligence'
  | 'Extras';

export const SUITE_ORDER: Suite[] = [
  'Marketing Intelligence',
  'Sales Intelligence',
  'Business Strategy',
  'Operations Intelligence',
  'Extras',
];

export interface ToolInputField {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  options?: string[];   // when present, render a single-select button group
  primary?: boolean;    // the field used for the min-length quality check
  // Guided-experience extras (all optional — the UI degrades gracefully when absent).
  description?: string; // helper text under the field
  example?: string;     // a concrete example value
  maxLength?: number;   // for the character counter (defaults to MAX_INPUT_CHARS)
}

export interface ToolConfig {
  slug: string;                 // route path (without leading slash)
  navLabel: string;             // sidebar label
  title: string;                // page header title
  subtitle: string;             // page header subtitle
  module: string;               // server module key (selects the prompt)
  costKey: keyof typeof TOKEN_COSTS;
  scored: boolean;              // shows IntelligenceIndicator + verdict
  ctaVerb: string;              // e.g. "Evaluate", "Analyze"
  suite: Suite;                 // sidebar / dashboard grouping
  worksWith: string[];          // module keys whose saved results can be injected as context
  inputs: ToolInputField[];
  // Guided-experience metadata (optional — getToolGuide derives sensible defaults).
  purpose?: string;             // one-line purpose shown in the header
  description?: string;         // longer description
  expectedOutcomes?: string[];  // the deliverables this analysis produces
  estimatedTime?: string;       // e.g. "30–60 seconds"
}

// Derives the guided-experience content for a tool, falling back to sensible defaults so every
// tool gets a header purpose, an "expected outcome" list, and an estimated time without bespoke
// copy. Generic tools emit the universal result contract, so that IS the deliverable list.
export const getToolGuide = (c: ToolConfig): {
  purpose: string; description: string; estimatedTime: string; outcomes: string[]; analysisType: string;
} => {
  const scoredLead = c.scored ? ['Intelligence Grade (0–100)'] : [];
  return {
    purpose: c.purpose || c.subtitle,
    description: c.description || c.subtitle,
    estimatedTime: c.estimatedTime || '30–60 seconds',
    outcomes: c.expectedOutcomes || [...scoredLead, ...UNIVERSAL_RESULT_SECTIONS],
    analysisType: c.scored ? 'Scored analysis' : 'Strategic analysis',
  };
};

// The nine generic analysis tools. Every one emits the universal result contract;
// `worksWith` encodes the connected-ecosystem relationships from the V1 doc.
export const TOOL_CONFIGS: Record<string, ToolConfig> = {
  audienceIntelligence: {
    slug: 'audience-intelligence',
    navLabel: 'Audience Intelligence',
    title: 'Audience Intelligence',
    subtitle: 'What does your audience really want? Map personas, pain points, and buying motivations.',
    module: 'AudienceIntel_Analyze',
    costKey: 'AudienceIntel',
    scored: false,
    ctaVerb: 'Analyze Audience',
    suite: 'Marketing Intelligence',
    purpose: 'Understand what your audience really wants — personas, pain points, and buying motivations.',
    estimatedTime: '30–60 seconds',
    worksWith: [],
    inputs: [
      { key: 'audience', label: 'Audience Description', placeholder: 'Describe your target audience in detail...', multiline: true, primary: true, description: 'Who they are, what they struggle with, and how they currently solve it. The more specific you are, the sharper the personas.', example: 'Busy founders of 5–20 person SaaS teams who struggle to keep marketing consistent.' },
      { key: 'product', label: 'Product', placeholder: 'What are you selling?', description: 'The product or service this audience would buy from you.', example: 'A done-for-you content marketing subscription.' },
      { key: 'industry', label: 'Industry', placeholder: 'e.g. Fitness, Fintech', description: 'The sector your audience operates in — shapes their norms and language.', example: 'B2B SaaS, DTC fitness, professional services.' },
      { key: 'businessType', label: 'Business Type', placeholder: 'e.g. B2B SaaS, E-commerce', description: 'Your business model — affects how this audience evaluates and buys.', example: 'B2B SaaS, E-commerce, Agency, Coaching.' },
    ],
  },

  marketIntelligence: {
    slug: 'market-intelligence',
    navLabel: 'Market Intelligence',
    title: 'Market Intelligence',
    subtitle: 'Where are the best opportunities in this market? Surface trends, gaps, and threats.',
    module: 'MarketIntel_Analyze',
    costKey: 'MarketIntel',
    scored: false,
    ctaVerb: 'Analyze Market',
    suite: 'Marketing Intelligence',
    worksWith: [],
    inputs: [
      { key: 'market', label: 'Market / Industry', placeholder: 'Describe the market you operate in...', multiline: true, primary: true, description: 'The market, its size and maturity, key trends, and where you play within it.', example: 'Mid-market HR software in North America — growing but crowded with legacy incumbents.' },
      { key: 'businessModel', label: 'Business Model', placeholder: 'e.g. Subscription, Marketplace', description: 'How you make (or plan to make) money in this market.', example: 'Subscription, Marketplace, Usage-based, One-time.' },
      { key: 'targetSegment', label: 'Target Segment', placeholder: 'Which segment are you targeting?', description: 'The specific slice of the market you focus on.', example: 'HR teams at 100–500 employee tech companies.' },
    ],
  },

  competitorAnalyzer: {
    slug: 'competitor-analyzer',
    navLabel: 'Competitor Analyzer',
    title: 'Competitor Analyzer',
    subtitle: 'How do you compare to competitors? Find advantages and differentiation opportunities.',
    module: 'Competitor_Analyze',
    costKey: 'Competitor',
    scored: false,
    ctaVerb: 'Analyze Competitors',
    suite: 'Marketing Intelligence',
    worksWith: [],
    inputs: [
      { key: 'competitors', label: 'Competitor Information', placeholder: 'List and describe your main competitors...', multiline: true, primary: true, description: 'List your main competitors with a line on each — what they offer, their pricing, and how they position.', example: 'Asana (broad PM), Monday (visual workflows), ClickUp (all-in-one, low price).' },
      { key: 'business', label: 'Your Business', placeholder: 'Describe your own business / positioning', description: 'Your own offering and how you position against these competitors.', example: 'A lightweight project tool built specifically for design agencies.' },
      { key: 'industry', label: 'Industry', placeholder: 'e.g. Project management software', description: 'The category you all compete in.', example: 'Project management software.' },
    ],
  },

  messagingAnalyzer: {
    slug: 'messaging-analyzer',
    navLabel: 'Messaging Analyzer',
    title: 'Messaging Analyzer',
    subtitle: 'Does this messaging persuade effectively? Score clarity, persuasion, and trust.',
    module: 'Messaging_Analyze',
    costKey: 'Messaging',
    scored: true,
    ctaVerb: 'Analyze Messaging',
    suite: 'Marketing Intelligence',
    worksWith: ['AudienceIntel_Analyze'],
    inputs: [
      { key: 'copyType', label: 'Copy Type', placeholder: '', options: ['Sales Copy', 'Ad Copy', 'Landing Page', 'Email'], description: 'The format of the copy — sets the benchmarks used to score it.' },
      { key: 'copy', label: 'Copy / Messaging', placeholder: 'Paste the copy you want analyzed...', multiline: true, primary: true, description: 'Paste the full copy exactly as written — headline, body, and call-to-action.', example: 'Your landing page headline + subhead + 3 benefit bullets + button text.' },
      { key: 'audience', label: 'Target Audience', placeholder: 'Who is this written for?', description: 'Who the copy is meant to persuade.', example: 'First-time SaaS founders comparing analytics tools.' },
    ],
  },

  contentStrategy: {
    slug: 'content-strategy',
    navLabel: 'Content Strategy',
    title: 'Content Strategy Tool',
    subtitle: 'What content should you create? Build pillars, topics, and a publishing strategy.',
    module: 'ContentStrategy_Analyze',
    costKey: 'ContentStrategy',
    scored: false,
    ctaVerb: 'Build Strategy',
    suite: 'Marketing Intelligence',
    worksWith: ['AudienceIntel_Analyze', 'MarketIntel_Analyze'],
    inputs: [
      { key: 'objectives', label: 'Objectives', placeholder: 'What do you want your content to achieve...', multiline: true, primary: true, description: 'What the content should achieve, plus any constraints (team size, cadence, budget).', example: 'Grow organic signups 3× in 6 months with a one-person content team.' },
      { key: 'businessType', label: 'Business Type', placeholder: 'e.g. Agency, SaaS, Creator', description: 'Your business model — shapes the right content mix.', example: 'Agency, SaaS, Creator, E-commerce.' },
      { key: 'industry', label: 'Industry', placeholder: 'e.g. Marketing, Health', description: 'Your sector — guides topics, tone, and channels.', example: 'Marketing, Health & wellness, Fintech.' },
      { key: 'audience', label: 'Audience', placeholder: 'Who are you trying to reach?', description: 'The people you want the content to reach and influence.', example: 'Marketing managers at early-stage startups.' },
    ],
  },

  campaignAnalyzer: {
    slug: 'campaign-analyzer',
    navLabel: 'Campaign Analyzer',
    title: 'Campaign Analyzer',
    subtitle: 'How can this campaign perform better? Audit, optimize, and plan to scale.',
    module: 'Campaign_Analyze',
    costKey: 'Campaign',
    scored: true,
    ctaVerb: 'Analyze Campaign',
    suite: 'Marketing Intelligence',
    worksWith: ['AudienceIntel_Analyze', 'Messaging_Analyze'],
    inputs: [
      { key: 'campaign', label: 'Campaign Details', placeholder: 'Describe the campaign in detail...', multiline: true, primary: true, description: 'Describe the campaign end-to-end — offer, creative, timing, and current results if any.', example: 'Black Friday push: email sequence + Meta ads offering 30% off annual plans.' },
      { key: 'goals', label: 'Goals', placeholder: 'e.g. Leads, sales, awareness', description: 'The primary outcomes you’re optimizing for.', example: 'Leads, Sales, Awareness, App installs.' },
      { key: 'audience', label: 'Audience', placeholder: 'Who is being targeted?', description: 'Who the campaign is aimed at.', example: 'Lapsed customers who haven’t purchased in 90 days.' },
      { key: 'channels', label: 'Channels', placeholder: 'e.g. Meta Ads, Email, SEO', description: 'Where the campaign runs.', example: 'Meta Ads, Google Search, Email, SEO.' },
    ],
  },

  offerAnalyzer: {
    slug: 'offer-analyzer',
    navLabel: 'Offer Analyzer',
    title: 'Offer Analyzer',
    subtitle: 'Would customers find this offer compelling? Diagnose value, pricing, and appeal.',
    module: 'OfferAnalyzer_Analyze',
    costKey: 'OfferAnalyzer',
    scored: true,
    ctaVerb: 'Analyze Offer',
    suite: 'Sales Intelligence',
    worksWith: ['Competitor_Analyze', 'AudienceIntel_Analyze'],
    inputs: [
      { key: 'offer', label: 'Offer Description', placeholder: 'Describe the core offer...', multiline: true, primary: true, description: 'What the buyer gets and the main promise — the core transformation or result.', example: 'A 12-week coaching program that gets founders their first 10 paying customers.' },
      { key: 'pricing', label: 'Pricing', placeholder: 'e.g. $49/mo, $499 one-time', description: 'Your price and how it’s structured.', example: '$49/mo, $499 one-time, or 3 × $199.' },
      { key: 'bonuses', label: 'Bonuses', placeholder: 'Any bonuses or add-ons included', description: 'Extras included to raise the perceived value.', example: 'Free onboarding call, template library, private community.' },
      { key: 'guarantees', label: 'Guarantees', placeholder: 'e.g. 30-day money-back', description: 'The risk-reversal you offer to lower buying friction.', example: '30-day money-back, or results-or-refund.' },
      { key: 'audience', label: 'Target Audience', placeholder: 'Who is this offer for?', description: 'Who the offer is designed for.', example: 'Solo, bootstrapped founders who are pre-revenue.' },
    ],
  },

  strategyLab: {
    slug: 'strategy-lab',
    navLabel: 'Strategy Lab',
    title: 'Strategy Lab',
    subtitle: 'Pressure-test any idea, campaign, or expansion before you commit — is it worth pursuing?',
    module: 'StrategyLab_Analyze',
    costKey: 'StrategyLab',
    scored: true,
    ctaVerb: 'Evaluate Strategy',
    suite: 'Business Strategy',
    worksWith: ['MarketIntel_Analyze', 'Competitor_Analyze'],
    inputs: [
      { key: 'type', label: 'What are you evaluating?', placeholder: '', options: ['Business Idea', 'Campaign Concept', 'Growth Initiative', 'Expansion Plan'], description: 'The kind of decision you’re pressure-testing — sets the evaluation lens.' },
      { key: 'concept', label: 'Description', placeholder: 'Describe the idea, concept, or initiative in detail...', multiline: true, primary: true, description: 'Describe the idea in detail — what it is, why now, and what makes it work. More context means a sharper verdict.', example: 'Launch a self-serve $29/mo tier of our enterprise product to reach smaller teams.' },
      { key: 'industry', label: 'Industry / Market', placeholder: 'e.g. B2B SaaS, DTC skincare', description: 'The market this idea plays in.', example: 'B2B SaaS, DTC skincare.' },
      { key: 'objective', label: 'Primary Objective', placeholder: 'e.g. Reach $10k MRR in 6 months', description: 'The specific outcome you’re aiming for, with a timeframe.', example: 'Reach $10k MRR within 6 months.' },
    ],
  },

  growthAnalyzer: {
    slug: 'growth-analyzer',
    navLabel: 'Growth Analyzer',
    title: 'Growth Analyzer',
    subtitle: 'Where can you grow fastest? Identify opportunities and revenue expansion plays.',
    module: 'Growth_Analyze',
    costKey: 'Growth',
    scored: true,
    ctaVerb: 'Analyze Growth',
    suite: 'Business Strategy',
    worksWith: ['MarketIntel_Analyze', 'AudienceIntel_Analyze', 'StrategyLab_Analyze'],
    inputs: [
      { key: 'business', label: 'Business Information', placeholder: 'Describe your business and current state...', multiline: true, primary: true, description: 'Your model, stage, and what’s working vs. stuck right now.', example: 'B2B SaaS at $20k MRR with strong retention but weak top-of-funnel.' },
      { key: 'performance', label: 'Current Performance', placeholder: 'e.g. $20k MRR, 5% MoM growth', description: 'Your current metrics and trajectory.', example: '$20k MRR, 5% MoM growth, 3% monthly churn.' },
      { key: 'objectives', label: 'Growth Objectives', placeholder: 'What growth are you targeting?', description: 'The growth you’re aiming for, and by when.', example: 'Double MRR within 9 months.' },
    ],
  },

  workflowAnalyzer: {
    slug: 'workflow-analyzer',
    navLabel: 'Workflow Analyzer',
    title: 'Workflow Analyzer',
    subtitle: 'Where are you wasting time, effort, and money? Find bottlenecks and automation wins.',
    module: 'Workflow_Analyze',
    costKey: 'WorkflowAnalyzer',
    scored: false,
    ctaVerb: 'Analyze Workflow',
    suite: 'Operations Intelligence',
    worksWith: [],
    inputs: [
      { key: 'workflow', label: 'Workflow Description', placeholder: 'Describe the process or workflow end-to-end...', multiline: true, primary: true, description: 'Describe the process end-to-end — what triggers it and what the final outcome is.', example: 'Inbound lead → qualification → demo → proposal → closed deal.' },
      { key: 'steps', label: 'Process Steps', placeholder: 'List the key steps, in order', description: 'The key steps in the order they happen.', example: '1) Form fill 2) SDR call 3) Demo 4) Proposal 5) Contract.' },
      { key: 'team', label: 'Team / Roles', placeholder: 'Who is involved at each step?', description: 'Who owns each step — roles and handoffs.', example: 'SDR qualifies, AE runs the demo, Ops sends the contract.' },
      { key: 'objectives', label: 'Objectives', placeholder: 'What is this workflow meant to achieve?', description: 'What a better version of this workflow should achieve.', example: 'Cut time-to-close from 30 days to 15.' },
    ],
  },
};

export const TOOL_CONFIG_LIST: ToolConfig[] = Object.values(TOOL_CONFIGS);

// module key -> lightweight metadata, for resolving worksWith references to labels.
const MODULE_META: Record<string, { label: string; slug: string }> = TOOL_CONFIG_LIST.reduce(
  (acc, t) => { acc[t.module] = { label: t.navLabel, slug: t.slug }; return acc; },
  {} as Record<string, { label: string; slug: string }>
);

export const getToolMeta = (module: string): { label: string; slug: string } | undefined => MODULE_META[module];

// --- SIDEBAR / DASHBOARD NAV REGISTRY ---
// Merges the bespoke tool pages (Angle Miner, Conversion Doctor, Workflow, TestLab)
// with the nine generic tools into the four V1 suites (+ Extras).
export interface NavEntry { path: string; label: string; description?: string; cost?: number; }

// Bespoke tool pages carry their own descriptions + server token costs
// (Angle Miner 3, Conversion Doctor 4, Workflow 6, TestLab 5 — see functions COSTS).
const BESPOKE_BY_SUITE: Record<Suite, NavEntry[]> = {
  'Marketing Intelligence': [
    { path: '/angle-miner', label: 'Angle Miner', description: 'Generate high-conversion psychological angles and marketing hooks.', cost: 3 },
  ],
  'Sales Intelligence': [
    { path: '/conversion-doctor', label: 'Conversion Doctor', description: 'Audit landing pages and funnels for conversion blockers and friction.', cost: 4 },
  ],
  'Business Strategy': [],
  'Operations Intelligence': [],
  'Extras': [
    { path: '/test-lab', label: 'TestLab Pro', description: 'Simulate ad performance and predict winning variations before launch.', cost: 5 },
    { path: '/workflow', label: 'Workflow Pipeline', description: 'Chain ideation, testing, and auditing into one guided campaign workflow.', cost: 6 },
  ],
};

export const NAV_SUITES: { suite: Suite; items: NavEntry[] }[] = SUITE_ORDER
  .map((suite) => ({
    suite,
    items: [
      ...BESPOKE_BY_SUITE[suite],
      ...TOOL_CONFIG_LIST
        .filter((t) => t.suite === suite)
        .map((t) => ({ path: `/${t.slug}`, label: t.navLabel, description: t.subtitle, cost: TOKEN_COSTS[t.costKey] })),
    ],
  }))
  .filter((g) => g.items.length > 0);
