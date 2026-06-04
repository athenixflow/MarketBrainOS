// MarketBrain OS — Admin Portal section registry + capability gating.
//
// Single source of truth for the admin sidebar: every section's route, label, group, and the
// permission scope needed to SEE it. The portal sidebar (App.tsx admin branch) and AdminPortal
// routing both read this. Server roles stay super_admin/ops_admin (no schema change) — this map
// just organizes the UI by capability so adding finer roles later is a config change, not a rewrite.

import { UserRole, PermissionScope } from '../types';

// Which permission scopes each platform role holds (mirrors securityEngine.ROLE_PERMISSIONS).
const SCOPE_BY_ROLE: Record<UserRole, PermissionScope[]> = {
  user: [],
  ops_admin: ['admin:read', 'admin:user_management', 'admin:token_management', 'analysis:execute', 'audit:execute', 'simulation:execute'],
  super_admin: ['admin:read', 'admin:user_management', 'admin:token_management', 'admin:system_config', 'admin:security_override', 'analysis:execute', 'audit:execute', 'simulation:execute'],
};

export const roleHasScope = (role: UserRole | undefined, scope: PermissionScope): boolean =>
  !!role && (SCOPE_BY_ROLE[role] || []).includes(scope);

export type AdminGroup = 'Overview' | 'People & Plans' | 'Operations' | 'Organizations' | 'Business' | 'Trust & Safety' | 'System';

export interface AdminSectionDef {
  key: string;                 // route slug under /admin (the index section uses '')
  label: string;
  group: AdminGroup;
  viewScope: PermissionScope;  // scope required to see/open the section
}

// Order within each group is the array order; groups render in GROUP_ORDER.
export const ADMIN_SECTIONS: AdminSectionDef[] = [
  { key: '',              label: 'Overview',       group: 'Overview',       viewScope: 'admin:read' },

  { key: 'users',         label: 'Users',          group: 'People & Plans', viewScope: 'admin:user_management' },
  { key: 'subscriptions', label: 'Subscriptions',  group: 'People & Plans', viewScope: 'admin:user_management' },
  { key: 'tokens',        label: 'Tokens',         group: 'People & Plans', viewScope: 'admin:token_management' },

  { key: 'analyses',      label: 'Analyses',       group: 'Operations',     viewScope: 'admin:read' },
  { key: 'tools',         label: 'Tools',          group: 'Operations',     viewScope: 'admin:read' },
  { key: 'ai-ops',        label: 'AI Operations',  group: 'Operations',     viewScope: 'admin:read' },
  { key: 'health',        label: 'Platform Health',group: 'Operations',     viewScope: 'admin:read' },
  { key: 'flags',         label: 'Feature Flags',  group: 'Operations',     viewScope: 'admin:read' },

  { key: 'workspaces',    label: 'Workspaces',     group: 'Organizations',  viewScope: 'admin:read' },
  { key: 'agencies',      label: 'Agencies',       group: 'Organizations',  viewScope: 'admin:read' },
  { key: 'enterprise',    label: 'Enterprise',     group: 'Organizations',  viewScope: 'admin:read' },

  { key: 'revenue',       label: 'Revenue',        group: 'Business',       viewScope: 'admin:read' },
  { key: 'reports',       label: 'Reports',        group: 'Business',       viewScope: 'admin:read' },

  { key: 'audit',         label: 'Audit Logs',     group: 'Trust & Safety', viewScope: 'admin:read' },
  { key: 'security',      label: 'Security',       group: 'Trust & Safety', viewScope: 'admin:read' },

  { key: 'notifications', label: 'Notifications',  group: 'System',         viewScope: 'admin:read' },
  { key: 'support',       label: 'Support',        group: 'System',         viewScope: 'admin:read' },
  { key: 'content',       label: 'Content',        group: 'System',         viewScope: 'admin:read' },
  { key: 'settings',      label: 'Settings',       group: 'System',         viewScope: 'admin:system_config' },
];

export const ADMIN_GROUP_ORDER: AdminGroup[] = ['Overview', 'People & Plans', 'Operations', 'Organizations', 'Business', 'Trust & Safety', 'System'];

export const adminPath = (key: string): string => (key ? `/admin/${key}` : '/admin');

/** Sections visible to a given role, grouped + ordered for the sidebar. */
export const visibleAdminSections = (role: UserRole | undefined): { group: AdminGroup; items: AdminSectionDef[] }[] =>
  ADMIN_GROUP_ORDER
    .map(group => ({
      group,
      items: ADMIN_SECTIONS.filter(s => s.group === group && roleHasScope(role, s.viewScope)),
    }))
    .filter(g => g.items.length > 0);

/** The section definition for a route key (defaults to Overview). */
export const sectionForKey = (key: string | undefined): AdminSectionDef =>
  ADMIN_SECTIONS.find(s => s.key === (key || '')) || ADMIN_SECTIONS[0];
