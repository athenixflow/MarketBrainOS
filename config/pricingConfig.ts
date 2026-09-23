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
    /*
     * THE LADDER (GTM parts 19 §4, 20 §2). Every number here is a decision with a
     * reason, and the two that moved most had the same cause: $7 was the right price
     * for Lagos and the wrong one everywhere else.
     *
     * Pro $19 sits just under ChatGPT Plus ($20), so "purpose-built, and cheaper than
     * the thing you are already paying for" is literally true, and under the $29–49
     * entry points of Copy.ai and Unbounce, which is honest about having no customer
     * proof yet. Team $79 for 5 seats is $15.80 a seat; the old $49 for TEN seats was
     * $4.90 and undercut Agency, so the bundle competed with the tier above it.
     *
     * A PRICE RISE IS ONLY FREE BEFORE ANYONE IS PAYING. That is today. Existing
     * accounts are on simulated billing, so nobody's charge changes; the sooner this
     * lands the fewer people it can ever surprise.
     */
    free:       { price: 0,   monthlyTokens: 20 },
    pro:        { price: 19,  monthlyTokens: 300 },
    team:       { price: 79,  monthlyTokens: 600,   membersPerWorkspace: 5 },
    agency:     { price: 199, monthlyTokens: 2000,  workspaces: 5,  membersPerWorkspace: 10, maxMembers: 50 },
    enterprise: { price: 999, monthlyTokens: 10000, agencies: 5, workspacesPerAgency: 5, membersPerWorkspace: 10, maxMembers: 250 },
  },
  /* Seats and workspaces priced against the tier they expand, not as an afterthought:
     a $4 seat on a $79 plan made the 6th seat nearly free and the plan above pointless. */
  expansion: { member: 12, workspace: 39, agency: 99 },
  tokenPacks: [
    /*
     * PACKS MUST NEVER UNDERCUT A PLAN — the config bug this fixes. At $5/100 a Free
     * user bought tokens at $0.050 while a Pro subscriber paid $0.070, so the rational
     * customer stayed on Free and topped up forever. Packs now start at $0.10 a token,
     * above every plan's included rate, and the ladder rewards subscribing.
     */
    { id: 'starter',    label: 'Starter Pack',    tokens: 100,   price: 10 },
    { id: 'growth',     label: 'Growth Pack',     tokens: 500,   price: 40 },
    { id: 'business',   label: 'Business Pack',   tokens: 1500,  price: 100 },
    { id: 'agency',     label: 'Agency Pack',     tokens: 5000,  price: 300 },
    { id: 'enterprise', label: 'Enterprise Pack', tokens: 10000, price: 500 },
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
