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
  // Institutional-grade forms: fields tagged `advanced` are optional context, collected under a
  // collapsible "Advanced context (optional)" disclosure so essentials stay front-and-center.
  group?: 'essential' | 'advanced';  // default 'essential'
  optional?: boolean;                // purely cosmetic — adds an "(optional)" hint to the label
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
      { key: 'geography', label: 'Geography / Region', placeholder: 'e.g. US + UK', group: 'advanced', description: 'Where these customers are — shapes culture, channels, and pricing.', example: 'United States & UK, English-speaking.' },
      { key: 'pricePoint', label: 'Price Point', placeholder: 'e.g. $49/mo', group: 'advanced', description: 'Roughly what they pay — drives expectations and objections.', example: '$49/mo, or $2k one-time.' },
      { key: 'currentCustomers', label: 'Current Customers', placeholder: 'Describe who already buys, if anyone...', multiline: true, group: 'advanced', description: 'Who buys today and what they have in common — grounds the personas in reality.', example: 'Mostly agency owners who found us through referrals.' },
      { key: 'objections', label: 'Known Objections', placeholder: 'Why do prospects hesitate or say no?', multiline: true, group: 'advanced', description: 'The doubts and blockers that stop people from buying.', example: '“Too expensive”, “We already use X”, “No time to switch”.' },
      { key: 'channels', label: 'Where They Spend Time', placeholder: 'Platforms / communities', group: 'advanced', description: 'Where this audience can actually be reached.', example: 'LinkedIn, niche Slack groups, YouTube.' },
      { key: 'goal', label: 'Your Goal', placeholder: 'What will you do with these insights?', group: 'advanced', description: 'The decision or asset this analysis should inform.', example: 'Write a landing page that converts cold traffic.' },
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
      { key: 'geography', label: 'Geography / Region', placeholder: 'e.g. North America', group: 'advanced', description: 'The geographies in scope — markets differ by region.', example: 'North America now, EU within a year.' },
      { key: 'companyStage', label: 'Your Stage', placeholder: 'e.g. $20k MRR, Series A', group: 'advanced', description: 'Where your company is today — frames what opportunities are realistic.', example: 'Pre-revenue, $20k MRR, or Series A.' },
      { key: 'competitors', label: 'Key Players / Competitors', placeholder: 'The main companies shaping this market...', multiline: true, group: 'advanced', description: 'Who currently dominates or disrupts this market.', example: 'Incumbent A (legacy), Startup B (fast-growing).' },
      { key: 'timeframe', label: 'Time Horizon', placeholder: 'e.g. Next 12 months', group: 'advanced', description: 'The planning window for acting on opportunities.', example: 'Next 12 months.' },
      { key: 'budget', label: 'Budget / Resources', placeholder: 'e.g. $5k/mo, 2-person team', group: 'advanced', description: 'Roughly what you can invest to capture opportunities.', example: '$5k/mo marketing budget, 2-person team.' },
      { key: 'constraints', label: 'Regulatory / Constraints', placeholder: 'Rules or limits shaping this market', multiline: true, group: 'advanced', description: 'Compliance, regulation, or structural limits to respect.', example: 'HIPAA; data-residency requirements.' },
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
      { key: 'yourPricing', label: 'Your Pricing', placeholder: 'e.g. $99/mo', group: 'advanced', description: 'Your price relative to theirs — central to positioning.', example: '$99/mo vs their $149/mo.' },
      { key: 'yourStrengths', label: 'Your Strengths', placeholder: 'Where you genuinely beat them today...', multiline: true, group: 'advanced', description: 'The areas where you already win.', example: 'Faster onboarding, better support, niche focus.' },
      { key: 'differentiators', label: 'Your Differentiators', placeholder: 'What only you offer...', multiline: true, group: 'advanced', description: 'The capabilities or angles unique to you.', example: 'The only tool with native X integration.' },
      { key: 'targetCustomer', label: 'Target Customer', placeholder: 'Who you’re both fighting to win', group: 'advanced', description: 'The customer you compete over — sharpens the comparison.', example: 'Design agencies, 5–50 staff.' },
      { key: 'competitorMarketing', label: 'How They Market', placeholder: 'Where/how competitors acquire customers...', multiline: true, group: 'advanced', description: 'Competitors’ go-to-market and channels.', example: 'Heavy SEO + paid search; large affiliate program.' },
      { key: 'geography', label: 'Geography / Region', placeholder: 'e.g. US-focused', group: 'advanced', description: 'The geographies where you compete.', example: 'US-focused; they’re global.' },
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
      { key: 'goal', label: 'Goal of This Copy', placeholder: 'The one action you want', group: 'advanced', description: 'The single action the reader should take.', example: 'Book a demo.' },
      { key: 'stage', label: 'Funnel Stage', placeholder: 'e.g. cold traffic, problem-aware', group: 'advanced', description: 'How aware/warm the reader is — changes what must be said.', example: 'Cold ad traffic; problem-aware.' },
      { key: 'product', label: 'Product / Offer', placeholder: 'What’s being sold here', group: 'advanced', description: 'The product or offer behind the copy.', example: 'A $29/mo analytics tool.' },
      { key: 'brandVoice', label: 'Brand Voice', placeholder: 'e.g. confident, plain-spoken', group: 'advanced', description: 'The tone the copy should match.', example: 'Confident, plain-spoken, a little playful.' },
      { key: 'objections', label: 'Objections to Overcome', placeholder: 'Doubts the copy must defuse...', multiline: true, group: 'advanced', description: 'The hesitations this copy needs to address.', example: '“Looks complicated”, “Not sure it’s worth it”.' },
      { key: 'channel', label: 'Where It Appears', placeholder: 'Placement / format constraints', group: 'advanced', description: 'The channel and any length/format limits.', example: 'Meta feed ad, 125-character primary text.' },
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
      { key: 'channels', label: 'Channels / Platforms', placeholder: 'Where you’ll publish', group: 'advanced', description: 'The platforms you’ll actually distribute on.', example: 'Blog/SEO, LinkedIn, YouTube, newsletter.' },
      { key: 'cadence', label: 'Cadence / Capacity', placeholder: 'How much you can produce', group: 'advanced', description: 'Realistic output volume — keeps the plan executable.', example: '2 blog posts + 3 LinkedIn posts per week.' },
      { key: 'team', label: 'Team / Resources', placeholder: 'Who creates the content', group: 'advanced', description: 'Who produces content and any budget.', example: 'One marketer plus a freelance writer.' },
      { key: 'currentContent', label: 'Current Content', placeholder: 'What you publish now and what works...', multiline: true, group: 'advanced', description: 'Existing content and what performs — what to double down on.', example: 'How-to posts do well; thought-leadership flops.' },
      { key: 'brandVoice', label: 'Brand Voice', placeholder: 'e.g. practical, no jargon', group: 'advanced', description: 'The voice your content should carry.', example: 'Practical, no jargon, founder-led.' },
      { key: 'kpis', label: 'Success Metrics', placeholder: 'How you’ll measure success', group: 'advanced', description: 'The outcomes content should drive.', example: 'Organic signups, newsletter subs, demo requests.' },
      { key: 'timeframe', label: 'Time Horizon', placeholder: 'e.g. next 2 quarters', group: 'advanced', description: 'The window this strategy covers.', example: 'Next two quarters.' },
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
      { key: 'budget', label: 'Budget', placeholder: 'e.g. $10k total, $300/day', group: 'advanced', description: 'Total and/or daily spend — frames what’s realistic.', example: '$10k total, $300/day on Meta.' },
      { key: 'timeframe', label: 'Timeline / Flight Dates', placeholder: 'e.g. Nov 20 – Dec 2', group: 'advanced', description: 'When the campaign runs.', example: 'Runs Nov 20 – Dec 2.' },
      { key: 'currentResults', label: 'Current Results / Metrics', placeholder: 'Performance so far, if live...', multiline: true, group: 'advanced', description: 'Live numbers so the audit can pinpoint the real problem.', example: 'CTR 0.8%, CPC $1.40, ROAS 1.2.' },
      { key: 'offer', label: 'Offer / Promotion', placeholder: 'The deal or hook used', group: 'advanced', description: 'The promotion driving the campaign.', example: '30% off annual plans.' },
      { key: 'creative', label: 'Creative / Assets', placeholder: 'Angles, formats, creatives used...', multiline: true, group: 'advanced', description: 'The creative approach and formats in play.', example: '3 video ads + 5 statics, UGC style.' },
      { key: 'kpis', label: 'Target KPIs', placeholder: 'The numbers that define success', group: 'advanced', description: 'Your success thresholds.', example: 'ROAS ≥ 3, CPA ≤ $40.' },
      { key: 'competitiveContext', label: 'Competitive Context', placeholder: 'What competitors are doing', group: 'advanced', description: 'Market conditions affecting the campaign.', example: 'Rivals heavily discounting this season.' },
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
      { key: 'competingOffers', label: 'Competing Offers', placeholder: 'What alternatives the buyer compares, and their prices...', multiline: true, group: 'advanced', description: 'The alternatives — including “do nothing” — your offer is judged against.', example: 'Competitor at $79/mo with fewer features.' },
      { key: 'valueMetric', label: 'Value / ROI', placeholder: 'The tangible result the buyer gets', group: 'advanced', description: 'The concrete payoff that justifies the price.', example: 'Saves ~10 hours/week; pays back in a month.' },
      { key: 'unitEconomics', label: 'Unit Economics (CAC / LTV)', placeholder: 'e.g. CAC $120, LTV $900', group: 'advanced', description: 'Acquisition cost and lifetime value, if known.', example: 'CAC $120, LTV $900.' },
      { key: 'objections', label: 'Buyer Objections', placeholder: 'Why buyers hesitate...', multiline: true, group: 'advanced', description: 'The doubts the offer must overcome.', example: '“Too pricey”, “Will my team adopt it?”.' },
      { key: 'pricingHistory', label: 'Pricing / Test History', placeholder: 'What you’ve tried and what happened...', multiline: true, group: 'advanced', description: 'Past pricing experiments and outcomes.', example: 'Tested $39 vs $49 — $49 converted better.' },
      { key: 'churnRate', label: 'Churn / Refund Rate', placeholder: 'e.g. 4% monthly churn', group: 'advanced', description: 'Retention signal for how strong the offer really is.', example: '4% monthly churn, 3% refunds.' },
      { key: 'positioning', label: 'Positioning', placeholder: 'How you want the offer perceived', group: 'advanced', description: 'The market position you’re going for.', example: 'The premium, done-for-you option.' },
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
      { key: 'budget', label: 'Budget / Resources', placeholder: 'e.g. $50k and 3 months', group: 'advanced', description: 'What you can commit to test or execute this.', example: '$50k and 3 months of a 2-person team.' },
      { key: 'timeframe', label: 'Time Horizon', placeholder: 'e.g. decision in 4 weeks', group: 'advanced', description: 'When you must decide and when payoff is expected.', example: 'Decide in 4 weeks; payoff within 6 months.' },
      { key: 'currentState', label: 'Current Business State', placeholder: 'Traction, revenue, team today...', multiline: true, group: 'advanced', description: 'Where you stand now — grounds the feasibility call.', example: '$20k MRR, 4 staff, profitable.' },
      { key: 'competitiveLandscape', label: 'Competitive Landscape', placeholder: 'Who else is doing this...', multiline: true, group: 'advanced', description: 'Existing players and white space.', example: 'Two incumbents; no one serving SMBs well.' },
      { key: 'risks', label: 'Known Risks / Concerns', placeholder: 'What worries you about this...', multiline: true, group: 'advanced', description: 'The risks you already see — the analysis will weigh them.', example: 'Long sales cycle, high build cost.' },
      { key: 'successCriteria', label: 'Definition of Success', placeholder: 'What “worth it” looks like', group: 'advanced', description: 'The concrete bar this idea must clear.', example: '$10k MRR from this line in 6 months.' },
      { key: 'constraints', label: 'Constraints', placeholder: 'Hard limits to respect', group: 'advanced', description: 'Non-negotiable limits on the plan.', example: 'No new hires; must ship by Q3.' },
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
      { key: 'channels', label: 'Current Acquisition Channels', placeholder: 'How customers find you and what each delivers...', multiline: true, group: 'advanced', description: 'Your channels and their rough contribution.', example: 'SEO (40%), referrals (35%), paid (25%).' },
      { key: 'funnelMetrics', label: 'Funnel Metrics', placeholder: 'Conversion at each stage, if known...', multiline: true, group: 'advanced', description: 'Stage-by-stage conversion — reveals the real bottleneck.', example: 'Visitor→trial 4%, trial→paid 25%, churn 3%.' },
      { key: 'unitEconomics', label: 'Unit Economics (CAC / LTV / Margin)', placeholder: 'e.g. CAC $150, LTV $1,200', group: 'advanced', description: 'The economics that decide which plays are worth it.', example: 'CAC $150, LTV $1,200, 80% margin.' },
      { key: 'budget', label: 'Growth Budget / Team', placeholder: 'e.g. $8k/mo, 1 marketer', group: 'advanced', description: 'Resources available to pursue growth.', example: '$8k/mo, 1 marketer + 1 contractor.' },
      { key: 'timeframe', label: 'Time Horizon', placeholder: 'e.g. next 3 quarters', group: 'advanced', description: 'The window for these growth plays.', example: 'Next three quarters.' },
      { key: 'constraints', label: 'Constraints', placeholder: 'Limits on how you can grow', group: 'advanced', description: 'Boundaries the strategy must respect.', example: 'No outbound sales; product-led only.' },
      { key: 'triedBefore', label: 'What You’ve Tried', placeholder: 'Past growth experiments and results...', multiline: true, group: 'advanced', description: 'Prior experiments — avoids repeating what failed.', example: 'Cold email flopped; webinars worked.' },
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
      { key: 'tools', label: 'Tools / Systems Used', placeholder: 'Software involved at each step...', multiline: true, group: 'advanced', description: 'The tools in the process — reveals automation and integration gaps.', example: 'HubSpot, Zapier, Google Sheets, Slack.' },
      { key: 'volume', label: 'Volume / Frequency', placeholder: 'e.g. ~200 leads/week', group: 'advanced', description: 'How often this runs and at what scale.', example: '~200 leads per week.' },
      { key: 'timePerStep', label: 'Time / Cost per Step', placeholder: 'Where time or money goes today...', multiline: true, group: 'advanced', description: 'The effort each step consumes — pinpoints waste.', example: 'Manual data entry ~2 hrs/day across the team.' },
      { key: 'painPoints', label: 'Known Pain Points', placeholder: 'Where it breaks, stalls, or frustrates...', multiline: true, group: 'advanced', description: 'The failure points you already feel.', example: 'Handoffs get lost; double data entry.' },
      { key: 'constraints', label: 'Constraints', placeholder: 'Budget / tech / policy limits', group: 'advanced', description: 'Limits on what changes are allowed.', example: 'Must stay within current toolset; no new spend.' },
      { key: 'successCriteria', label: 'Definition of Success', placeholder: 'What a fixed workflow achieves', group: 'advanced', description: 'The concrete target for the improved process.', example: 'Cut processing time 50% with no added headcount.' },
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
