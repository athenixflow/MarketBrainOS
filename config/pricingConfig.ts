// Client mirror of the server pricing config (functions/src/index.ts DEFAULT_PRICING_CONFIG).
// Source of truth for the pricing page, token store, Billing Center and admin pricing editor when
// the live `pricing_config/global` Firestore doc is absent. Keep the numbers in sync with the server
// default — the live doc (edited via updatePricingConfig) overrides both at runtime.

export type Tier = 'free' | 'pro' | 'team' | 'agency' | 'enterprise';

export interface PlanConfig {
  price: number;            // USD / month
  monthlyTokens: number;    // included tokens that reset each cycle
  membersPerWorkspace?: number;
  workspaces?: number;          // agency: workspaces it may own
  agencies?: number;            // enterprise: agencies it may own
  workspacesPerAgency?: number; // enterprise
  maxMembers?: number;          // total org capacity
}

export interface TokenPack { id: string; label: string; tokens: number; price: number; }

export interface PricingConfig {
  plans: Record<Tier, PlanConfig>;
  expansion: { member: number; workspace: number; agency: number };
  tokenPacks: TokenPack[];
  toolCosts: Record<string, number>;
  analysisTiers: { standard: number; premium: number; advanced: number };
  renewalDays: number;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  plans: {
    free:       { price: 0,   monthlyTokens: 20 },
    pro:        { price: 7,   monthlyTokens: 100 },
    team:       { price: 49,  monthlyTokens: 400,   membersPerWorkspace: 10 },
    agency:     { price: 199, monthlyTokens: 2000,  workspaces: 5,  membersPerWorkspace: 10, maxMembers: 50 },
    enterprise: { price: 999, monthlyTokens: 10000, agencies: 5, workspacesPerAgency: 5, membersPerWorkspace: 10, maxMembers: 250 },
  },
  expansion: { member: 4, workspace: 25, agency: 99 },
  tokenPacks: [
    { id: 'starter',    label: 'Starter Pack',    tokens: 100,   price: 5 },
    { id: 'growth',     label: 'Growth Pack',     tokens: 500,   price: 20 },
    { id: 'business',   label: 'Business Pack',   tokens: 1500,  price: 50 },
    { id: 'agency',     label: 'Agency Pack',     tokens: 5000,  price: 150 },
    { id: 'enterprise', label: 'Enterprise Pack', tokens: 10000, price: 250 },
  ],
  toolCosts: {
    AngleMiner_Generate: 3, AngleMiner_Improve: 1, ConversionDoctor_Audit: 4, TestLab_Simulation: 5,
    Workflow_ImproveAssets: 6, StrategyLab_Analyze: 5, OfferAnalyzer_Analyze: 4, AudienceIntel_Analyze: 4,
    MarketIntel_Analyze: 5, Competitor_Analyze: 4, Messaging_Analyze: 3, ContentStrategy_Analyze: 4,
    Campaign_Analyze: 4, Growth_Analyze: 5, Workflow_Analyze: 5,
  },
  analysisTiers: { standard: 3, premium: 4, advanced: 5 },
  renewalDays: 30,
};

// Presentation metadata for the 5-plan pricing page (capacity blurbs + feature bullets).
export const PLAN_META: Record<Tier, { name: string; tagline: string; capacity: string[]; features: string[] }> = {
  free: {
    name: 'Free', tagline: 'Get started',
    capacity: ['1 user'],
    features: ['Limited analysis history', 'Limited reports', 'Basic platform access'],
  },
  pro: {
    name: 'Pro', tagline: 'For solo operators',
    capacity: ['1 user'],
    features: ['Full access to core tools', 'Unlimited analysis history', 'Advanced reports', 'Token top-ups'],
  },
  team: {
    name: 'Team Workspace', tagline: 'For small teams',
    capacity: ['1 workspace', 'Up to 10 members'],
    features: ['Shared workspace & reports', 'Team collaboration', 'Activity tracking', 'Workspace analytics'],
  },
  agency: {
    name: 'Agency', tagline: 'For agencies',
    capacity: ['Up to 5 workspaces', 'Up to 10 members each', 'Max 50 members'],
    features: ['Agency dashboard', 'Client management', 'Cross-workspace visibility', 'Agency reporting'],
  },
  enterprise: {
    name: 'Enterprise', tagline: 'For organizations',
    capacity: ['Up to 5 agencies', '5 workspaces / agency', 'Max 250 members'],
    features: ['Enterprise dashboard & analytics', 'Executive visibility', 'Multi-agency oversight', 'Priority support'],
  },
};

// Order of the plan ladder (used for upgrade flows and pricing-page rendering).
export const PLAN_ORDER: Tier[] = ['free', 'pro', 'team', 'agency', 'enterprise'];

/** Total monthly base capacity (members) a plan implies, used for display. */
export const planMaxMembers = (cfg: PricingConfig, tier: Tier): number => {
  const p = cfg.plans[tier];
  if (p.maxMembers) return p.maxMembers;
  if (p.membersPerWorkspace) return p.membersPerWorkspace;
  return 1;
};
