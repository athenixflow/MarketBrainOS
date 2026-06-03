// MarketBrain OS — Access & Navigation Model (single source of truth)
//
// Centralizes subscription-tier ranking and feature visibility so the Sidebar, Dashboard
// quick-actions, and Settings all gate features identically. Previously these were scattered
// inline `profile?.tier === 'x'` checks (App.tsx Sidebar, Dashboard). Governing principle:
// ONE platform with progressive unlocks — a user only SEES what their plan/membership grants.

import { UserTier, UserProfile, UserMembership } from '../types';

// Tier ladder (low → high). free/pro are personal; team/agency/enterprise add org containers.
export const TIER_ORDER: UserTier[] = ['free', 'pro', 'team', 'agency', 'enterprise'];

export const tierRank = (t?: UserTier | null): number => {
  const i = TIER_ORDER.indexOf((t ?? 'free') as UserTier);
  return i < 0 ? 0 : i;
};

/** True when `tier` is at least `min` on the ladder (e.g. tierAtLeast('agency','team')). */
export const tierAtLeast = (tier: UserTier | undefined | null, min: UserTier): boolean =>
  tierRank(tier) >= tierRank(min);

// Features whose visibility depends on plan/membership.
export type FeatureKey =
  | 'dashboard' | 'tools' | 'history' | 'reports'
  | 'teamWorkspace' | 'agencyHub' | 'enterpriseSuite'
  | 'billing' | 'settings' | 'support';

export interface AccessContext {
  profile?: UserProfile | null;
  memberships?: UserMembership[];
}

// Can the current user SEE this feature? Org features unlock by tier OR by membership in a
// container of that family (a user invited to a workspace can access it regardless of tier).
// Mirrors the spec's plan-visibility matrix: Team→teamWorkspace, Agency→+agencyHub,
// Enterprise→+enterpriseSuite. Core/account features are always visible to a signed-in user.
export const canSeeFeature = (key: FeatureKey, ctx: AccessContext): boolean => {
  const tier = ctx.profile?.tier;
  const memberships = ctx.memberships ?? [];
  switch (key) {
    case 'teamWorkspace':
      return tierAtLeast(tier, 'team') || memberships.some(m => m.family === 'workspace');
    case 'agencyHub':
      return tierAtLeast(tier, 'agency') || memberships.some(m => m.family === 'agency');
    case 'enterpriseSuite':
      return tierAtLeast(tier, 'enterprise') || memberships.some(m => m.family === 'enterprise');
    case 'dashboard':
    case 'tools':
    case 'history':
    case 'reports':
    case 'billing':
    case 'settings':
    case 'support':
      return true;
    default:
      return false;
  }
};

// The next tier a user would upgrade TO in order to unlock a locked org feature — drives the
// "Upgrade to X" cards shown in place of hidden nav links.
export const upgradeTargetFor = (key: FeatureKey): { tier: UserTier; label: string } | null => {
  switch (key) {
    case 'teamWorkspace':   return { tier: 'team', label: 'Team' };
    case 'agencyHub':       return { tier: 'agency', label: 'Agency' };
    case 'enterpriseSuite': return { tier: 'enterprise', label: 'Enterprise' };
    default: return null;
  }
};

// --- STRUCTURAL NAVIGATION MODEL ---
// The non-tool nav links, grouped. The Analysis-Tools section itself is rendered separately
// from NAV_SUITES (config/toolConfigs) since those are data-driven. Each link carries an
// optional `feature` gate consumed via canSeeFeature.
export interface NavLink {
  label: string;
  path: string;
  feature?: FeatureKey; // undefined → always visible to any signed-in user
  exact?: boolean;      // active-match uses exact equality (for '/')
}

export interface NavGroup {
  heading?: string;
  links: NavLink[];
}

export const NAV_CORE: NavGroup = {
  links: [
    { label: 'Dashboard', path: '/', feature: 'dashboard', exact: true },
    { label: 'History', path: '/history', feature: 'history' },
    { label: 'Reports', path: '/reports', feature: 'reports' },
  ],
};

export const NAV_COLLABORATION: NavGroup = {
  heading: 'Collaboration',
  links: [
    { label: 'Team Workspace', path: '/team', feature: 'teamWorkspace' },
    { label: 'Agency Hub', path: '/agency', feature: 'agencyHub' },
    { label: 'Enterprise Suite', path: '/enterprise', feature: 'enterpriseSuite' },
  ],
};

export const NAV_ACCOUNT: NavGroup = {
  heading: 'Account',
  links: [
    { label: 'Billing', path: '/pricing', feature: 'billing' },
    { label: 'Settings', path: '/settings', feature: 'settings' },
    { label: 'Support', path: '/support', feature: 'support' },
  ],
};

/** Visible links within a group for the given access context. */
export const visibleLinks = (group: NavGroup, ctx: AccessContext): NavLink[] =>
  group.links.filter(l => !l.feature || canSeeFeature(l.feature, ctx));
