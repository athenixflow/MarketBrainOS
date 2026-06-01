// MarketBrain OS — Centralized Permission Engine (Phase 6.0 / Master Wiring)
//
// SINGLE source of truth for "can this member do X in this container?". Components and
// services MUST call `can(...)` rather than hardcoding role checks. This keeps the matrix
// in one place and lets the same rules be mirrored server-side (Cloud Functions +
// firestore.rules). Pure functions only — no I/O — so it is trivially testable.

import { WorkspaceRole, AgencyRole, EnterpriseRole } from '../types';

// The full set of gated actions across all organizational layers (Master Wiring matrix).
export type PermissionAction =
  | 'analysis:view'
  | 'analysis:create'
  | 'analysis:delete'
  | 'reports:view'
  | 'reports:create'
  | 'members:manage'
  | 'clients:manage'
  | 'departments:manage'
  | 'billing:manage'
  | 'settings:manage'
  | 'container:delete'
  | 'ownership:transfer';

// A user's membership within a specific container instance.
export type Membership =
  | { family: 'workspace'; role: WorkspaceRole }
  | { family: 'agency'; role: AgencyRole }
  | { family: 'enterprise'; role: EnterpriseRole };

// --- TEAM WORKSPACE matrix (spec 1) ---
const WORKSPACE_MATRIX: Record<WorkspaceRole, PermissionAction[]> = {
  owner: [
    'analysis:view', 'analysis:create', 'analysis:delete',
    'reports:view', 'reports:create',
    'members:manage', 'billing:manage', 'settings:manage',
    'container:delete', 'ownership:transfer',
  ],
  admin: [
    'analysis:view', 'analysis:create', 'analysis:delete',
    'reports:view', 'reports:create',
    'members:manage', 'settings:manage',
    // Cannot: container:delete, ownership:transfer, billing:manage
  ],
  manager: [
    'analysis:view', 'analysis:create',
    'reports:view', 'reports:create',
  ],
  analyst: [
    'analysis:view', 'analysis:create',
    'reports:view',
  ],
  viewer: [
    'analysis:view', 'reports:view',
  ],
};

// --- AGENCY matrix (spec 2). Inherits the workspace shape, adds client management. ---
const AGENCY_MATRIX: Record<AgencyRole, PermissionAction[]> = {
  agency_owner: [
    'analysis:view', 'analysis:create', 'analysis:delete',
    'reports:view', 'reports:create',
    'members:manage', 'clients:manage', 'billing:manage', 'settings:manage',
    'container:delete', 'ownership:transfer',
  ],
  agency_director: [
    'analysis:view', 'analysis:create', 'analysis:delete',
    'reports:view', 'reports:create',
    'members:manage', 'clients:manage', 'settings:manage',
  ],
  account_manager: [
    // Scoped to assigned clients (enforced separately via client_assignments).
    'analysis:view', 'analysis:create',
    'reports:view', 'reports:create',
    'clients:manage',
  ],
  strategist: [
    'analysis:view', 'analysis:create',
    'reports:view', 'reports:create',
  ],
  analyst: [
    'analysis:view', 'analysis:create',
    'reports:view',
  ],
  viewer: [
    'analysis:view', 'reports:view',
  ],
};

// --- ENTERPRISE matrix (spec 3). Read-only aggregation layer — no analysis mutation. ---
const ENTERPRISE_MATRIX: Record<EnterpriseRole, PermissionAction[]> = {
  enterprise_owner: [
    'analysis:view', 'reports:view', 'reports:create',
    'members:manage', 'departments:manage', 'billing:manage', 'settings:manage',
    'container:delete', 'ownership:transfer',
  ],
  executive_admin: [
    'analysis:view', 'reports:view', 'reports:create',
    'members:manage', 'departments:manage', 'settings:manage',
  ],
  department_director: [
    'analysis:view', 'reports:view', 'reports:create',
    'departments:manage',
  ],
  department_manager: [
    'analysis:view', 'reports:view',
  ],
  executive_viewer: [
    'analysis:view', 'reports:view',
  ],
};

/** Core check: does this membership grant the requested action? */
export const can = (action: PermissionAction, membership?: Membership | null): boolean => {
  if (!membership) return false;
  switch (membership.family) {
    case 'workspace': return WORKSPACE_MATRIX[membership.role]?.includes(action) ?? false;
    case 'agency': return AGENCY_MATRIX[membership.role]?.includes(action) ?? false;
    case 'enterprise': return ENTERPRISE_MATRIX[membership.role]?.includes(action) ?? false;
    default: return false;
  }
};

// Agency client-level access (Phase 6.2): owners/directors see every client; everyone else
// only the clients they are explicitly assigned to (via client_assignments).
export const canAccessClient = (
  agencyRole: AgencyRole | undefined,
  hasAssignment: boolean
): boolean => {
  if (!agencyRole) return false;
  if (agencyRole === 'agency_owner' || agencyRole === 'agency_director') return true;
  return hasAssignment;
};

/** All actions a membership grants (handy for UI gating / debugging). */
export const permissionsFor = (membership?: Membership | null): PermissionAction[] => {
  if (!membership) return [];
  switch (membership.family) {
    case 'workspace': return WORKSPACE_MATRIX[membership.role] ?? [];
    case 'agency': return AGENCY_MATRIX[membership.role] ?? [];
    case 'enterprise': return ENTERPRISE_MATRIX[membership.role] ?? [];
    default: return [];
  }
};

// Human-readable labels for role pickers across the org layers.
export const ROLE_LABELS: Record<string, string> = {
  // workspace
  owner: 'Owner', admin: 'Admin', manager: 'Manager', analyst: 'Analyst', viewer: 'Viewer',
  // agency
  agency_owner: 'Agency Owner', agency_director: 'Agency Director',
  account_manager: 'Account Manager', strategist: 'Strategist',
  // enterprise
  enterprise_owner: 'Enterprise Owner', executive_admin: 'Executive Admin',
  department_director: 'Department Director', department_manager: 'Department Manager',
  executive_viewer: 'Executive Viewer',
};
