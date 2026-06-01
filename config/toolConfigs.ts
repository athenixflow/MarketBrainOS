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
}

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
    worksWith: [],
    inputs: [
      { key: 'audience', label: 'Audience Description', placeholder: 'Describe your target audience in detail...', multiline: true, primary: true },
      { key: 'product', label: 'Product', placeholder: 'What are you selling?' },
      { key: 'industry', label: 'Industry', placeholder: 'e.g. Fitness, Fintech' },
      { key: 'businessType', label: 'Business Type', placeholder: 'e.g. B2B SaaS, E-commerce' },
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
      { key: 'market', label: 'Market / Industry', placeholder: 'Describe the market you operate in...', multiline: true, primary: true },
      { key: 'businessModel', label: 'Business Model', placeholder: 'e.g. Subscription, Marketplace' },
      { key: 'targetSegment', label: 'Target Segment', placeholder: 'Which segment are you targeting?' },
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
      { key: 'competitors', label: 'Competitor Information', placeholder: 'List and describe your main competitors...', multiline: true, primary: true },
      { key: 'business', label: 'Your Business', placeholder: 'Describe your own business / positioning' },
      { key: 'industry', label: 'Industry', placeholder: 'e.g. Project management software' },
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
      { key: 'copyType', label: 'Copy Type', placeholder: '', options: ['Sales Copy', 'Ad Copy', 'Landing Page', 'Email'] },
      { key: 'copy', label: 'Copy / Messaging', placeholder: 'Paste the copy you want analyzed...', multiline: true, primary: true },
      { key: 'audience', label: 'Target Audience', placeholder: 'Who is this written for?' },
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
      { key: 'objectives', label: 'Objectives', placeholder: 'What do you want your content to achieve...', multiline: true, primary: true },
      { key: 'businessType', label: 'Business Type', placeholder: 'e.g. Agency, SaaS, Creator' },
      { key: 'industry', label: 'Industry', placeholder: 'e.g. Marketing, Health' },
      { key: 'audience', label: 'Audience', placeholder: 'Who are you trying to reach?' },
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
      { key: 'campaign', label: 'Campaign Details', placeholder: 'Describe the campaign in detail...', multiline: true, primary: true },
      { key: 'goals', label: 'Goals', placeholder: 'e.g. Leads, sales, awareness' },
      { key: 'audience', label: 'Audience', placeholder: 'Who is being targeted?' },
      { key: 'channels', label: 'Channels', placeholder: 'e.g. Meta Ads, Email, SEO' },
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
      { key: 'offer', label: 'Offer Description', placeholder: 'Describe the core offer...', multiline: true, primary: true },
      { key: 'pricing', label: 'Pricing', placeholder: 'e.g. $49/mo, $499 one-time' },
      { key: 'bonuses', label: 'Bonuses', placeholder: 'Any bonuses or add-ons included' },
      { key: 'guarantees', label: 'Guarantees', placeholder: 'e.g. 30-day money-back' },
      { key: 'audience', label: 'Target Audience', placeholder: 'Who is this offer for?' },
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
      { key: 'type', label: 'What are you evaluating?', placeholder: '', options: ['Business Idea', 'Campaign Concept', 'Growth Initiative', 'Expansion Plan'] },
      { key: 'concept', label: 'Description', placeholder: 'Describe the idea, concept, or initiative in detail...', multiline: true, primary: true },
      { key: 'industry', label: 'Industry / Market', placeholder: 'e.g. B2B SaaS, DTC skincare' },
      { key: 'objective', label: 'Primary Objective', placeholder: 'e.g. Reach $10k MRR in 6 months' },
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
      { key: 'business', label: 'Business Information', placeholder: 'Describe your business and current state...', multiline: true, primary: true },
      { key: 'performance', label: 'Current Performance', placeholder: 'e.g. $20k MRR, 5% MoM growth' },
      { key: 'objectives', label: 'Growth Objectives', placeholder: 'What growth are you targeting?' },
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
      { key: 'workflow', label: 'Workflow Description', placeholder: 'Describe the process or workflow end-to-end...', multiline: true, primary: true },
      { key: 'steps', label: 'Process Steps', placeholder: 'List the key steps, in order' },
      { key: 'team', label: 'Team / Roles', placeholder: 'Who is involved at each step?' },
      { key: 'objectives', label: 'Objectives', placeholder: 'What is this workflow meant to achieve?' },
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
