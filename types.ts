

export type NavigationItem = 'Dashboard' | 'AngleMiner X' | 'TestLab Pro' | 'Conversion Doctor' | 'Workflow';

// Subscription tier ladder. Free→Pro are personal; Team/Agency/Enterprise unlock the
// organizational containers (Phase 6). Higher tiers only ADD capability — they never
// change the single shared core (one analysis engine, one token engine, one history).
export type UserTier = 'free' | 'pro' | 'team' | 'agency' | 'enterprise';

// Platform-level role (admin console access). Distinct from the membership role families
// below, which govern a user's rights *inside* a workspace/agency/enterprise container.
export type UserRole = 'user' | 'super_admin' | 'ops_admin';

// --- PHASE 6: ORGANIZATIONAL LAYERS ---

// Where an analysis/report is visible. Absence is treated as 'private' for backward
// compatibility with all V1 records (which carry no visibility field).
export type VisibilityType = 'private' | 'team' | 'client' | 'enterprise';

// Membership role families (separate per layer; do not conflate with platform UserRole).
export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'analyst' | 'viewer';
export type AgencyRole =
  | 'agency_owner'
  | 'agency_director'
  | 'account_manager'
  | 'strategist'
  | 'analyst'
  | 'viewer';
export type EnterpriseRole =
  | 'enterprise_owner'
  | 'executive_admin'
  | 'department_director'
  | 'department_manager'
  | 'executive_viewer';

// The active organizational context a user is acting within. Drives history/reports/nav
// and stamps new analyses. 'personal' is the V1 default (only the creator can see).
export type ScopeLevel = 'personal' | 'team' | 'client' | 'enterprise';

export interface Scope {
  level: ScopeLevel;
  workspaceId?: string;
  agencyId?: string;
  clientId?: string;
  enterpriseId?: string;
}

// Shared ownership stamp written onto every analysis and report. All ids optional/null so
// V1 records (creator-only, private) remain valid without migration.
export interface OwnershipStamp {
  creator_user_id: string;
  visibility_type: VisibilityType;
  workspace_id?: string | null;
  agency_id?: string | null;
  client_id?: string | null;
  enterprise_id?: string | null;
}

// Unified report record (Master Wiring: one reporting engine). Carries the same ownership
// stamp as analyses so visibility/scope rules are identical across both.
export interface Report {
  id?: string;
  title: string;
  report_type: string;   // 'analysis' | 'team' | 'client' | 'executive' | 'department' | ...
  content: any;          // serialized payload (sections, metrics, etc.)
  created_at: string;    // ISO
  creator_user_id: string;
  visibility_type: VisibilityType;
  workspace_id?: string | null;
  agency_id?: string | null;
  client_id?: string | null;
  enterprise_id?: string | null;
}

// A container the user belongs to (loaded by ScopeContext to populate the scope switcher
// and resolve the active membership for the permission engine).
export interface UserMembership {
  family: 'workspace' | 'agency' | 'enterprise';
  containerId: string;
  name: string;
  role: WorkspaceRole | AgencyRole | EnterpriseRole;
  // For agency client-workspaces: the parent agency id (so we can scope to a client).
  agencyId?: string;
}

export type PermissionScope = 
  | 'analysis:execute' 
  | 'audit:execute' 
  | 'simulation:execute' 
  | 'admin:read'
  | 'admin:user_management'
  | 'admin:token_management'
  | 'admin:system_config'
  | 'admin:security_override';

export type SystemLoadLevel = 'NORMAL' | 'CONGESTED' | 'CRITICAL' | 'EMERGENCY';

// Client-side cost mirrors for UI checks
export const TOKEN_COSTS = {
  AngleMiner: 3,
  ConversionDoctor: 4,
  TestLab: 5,
  Workflow: 6,
  // PRD §14–22 tools
  StrategyLab: 5,
  OfferAnalyzer: 4,
  AudienceIntel: 4,
  MarketIntel: 5,
  Competitor: 4,
  Messaging: 3,
  ContentStrategy: 4,
  Campaign: 4,
  Growth: 5,
  WorkflowAnalyzer: 5
};

// Shared result shape for the PRD §14–22 analysis tools.
// `sections` carries each tool's PRD-specific result sections as titled bullet lists.
export interface AnalysisSection {
  title: string;
  items: string[];
}

export interface ToolAnalysisResult {
  score?: number;     // 0–100 for scored tools (Offer, Messaging, Campaign, Growth, Strategy)
  verdict?: string;   // short decision label, when applicable
  summary: string;    // executive summary
  sections: AnalysisSection[];
  savedId?: string;   // Firestore id of the persisted record (set after save), for delete
}

export interface SystemSettings {
  emergency_lockdown: boolean;
  last_updated: string;
  updated_by: string;
}

export interface AdminSettings {
  maintenance_mode: boolean;
  analyses_paused: boolean;
  // Keyed by the server module key (MODULE_MAPPING value). Covers the original 4
  // bespoke tools plus the 9 generic §14–22 tools.
  modules_enabled: Record<string, boolean>;
  last_updated?: string;
  updated_by?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  tokens: number;
  tier: UserTier;
  role: UserRole;
  last_active?: string;
  risk_score?: number;
  is_suspended?: boolean;
  suspension_reason?: string;
  bot_confidence_score?: number; 
  permissions?: PermissionScope[];
  // Security Meta
  last_verification?: string; // Timestamp of last step-up auth
  session_started?: string;
  is_verified_admin?: boolean;
  // Account / onboarding
  onboarded?: boolean;
  // Subscription lifecycle (§30) — server-authoritative
  subscription_status?: SubscriptionStatus;
  plan_renews_at?: string;
  subscription_started_at?: string;
}

export type SubscriptionStatus = 'free' | 'active' | 'past_due' | 'cancelled' | 'expired';

export type NotificationCategory =
  | 'Analysis' | 'Subscription' | 'Token' | 'Payment' | 'System'
  // Phase 6 organizational events
  | 'Member' | 'Client' | 'Report' | 'Enterprise';

export interface AppNotification {
  id: string;
  uid: string;
  category: NotificationCategory;
  title: string;
  body?: string;
  read: boolean;
  created_at: string; // ISO
}

export interface SecurityEvent {
  id: string;
  timestamp: string;
  user_id?: string;
  event_type: 
    | 'SSRF_ATTEMPT' 
    | 'MALFORMED_INPUT' 
    | 'UNAUTHORIZED_ACCESS' 
    | 'RATE_LIMIT_EXCEEDED' 
    | 'BOT_BEHAVIOR_DETECTED' 
    | 'ADMIN_ANOMALY_DETECTED'
    | 'STEP_UP_FAILURE'
    | 'DESTRUCTIVE_ACTION_ATTEMPT'
    | 'PRIVILEGE_ESCALATION_ATTEMPT'
    | 'QUOTA_EXCEEDED'
    | 'SYSTEM_LOAD_REJECTION'
    | 'DEGRADED_MODE_TRIGGERED'
    | 'LEDGER_INTEGRITY_VIOLATION'
    | 'SYSTEM_EMERGENCY_ACTIVATED'
    | 'SYSTEM_EMERGENCY_DEACTIVATED'
    | 'HONEYPOT_TRIGGER'
    | 'CONTRACT_VIOLATION'
    | 'SYSTEM_RECOVERY';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  input_payload?: string;
  risk_increment: number;
  identity_fingerprint?: string;
  hash: string;
  previous_hash: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  admin_email: string;
  admin_role: UserRole;
  action_type: string;
  target: string;
  metadata?: any;
  hash: string;
  previous_hash: string;
}

export interface ActionLogEntry {
  id: string;
  timestamp?: string; // Optional: Client logs use this
  created_at?: any;   // Optional: Server logs use this (Firestore Timestamp)
  user_id?: string;   // Optional: Client logs use this
  uid?: string;       // Optional: Server logs use this
  module: string;
  action?: string;
  metadata?: any;
  hash?: string;
  previous_hash?: string;
  // Server-side specific fields
  status?: 'success' | 'failed_refunded' | 'blocked';
  tokens_used?: number;
  error_code?: string;
  // Top-up specific fields
  tokens_added?: number;
  amount_paid?: number;
  payment_reference?: string;
}

export interface PaymentRecord {
  id: string;
  uid: string;
  payment_reference: string;
  amount_paid: number;
  tokens_credited: number;
  provider?: string;
  status?: 'completed' | 'pending' | 'failed';
  created_at?: any;
}

export interface MarketingAngle {
  title: string;
  hook: string;
  rational: string;
  score: number;
  type?: AngleType;     // V1 Tool Architecture angle taxonomy
  improved?: string;
  improving?: boolean;
}

// The 8 named angle types from the V1 Tool Architecture doc.
export type AngleType =
  | 'Emotional'
  | 'Fear'
  | 'Aspiration'
  | 'Curiosity'
  | 'Authority'
  | 'Differentiation'
  | 'Story'
  | 'Contrarian';

export const ANGLE_TYPES: AngleType[] = [
  'Emotional', 'Fear', 'Aspiration', 'Curiosity',
  'Authority', 'Differentiation', 'Story', 'Contrarian',
];

export interface AngleMinerResults {
  angles: MarketingAngle[];
  hooks?: {
    platform: string;
    short: string;
    expanded: string;
  }[];
}

export interface TestLabVariant {
  label: string;
  text: string;
  score: number;
}

export interface TestLabResults {
  variants: TestLabVariant[];
  winnerLabel: string;
  explanation: string;
}

export interface AuditIssue {
  blocker: string;
  impact: string;
}

export interface AuditFix {
  what: string;
  how: string;
  expectedResult: string;
}

export interface AuditRewrite {
  label: string;
  text: string;
}

export interface AuditResult {
  score: number;
  summary: string;
  issues: AuditIssue[];
  fixes: AuditFix[];
  rewrites?: AuditRewrite[];
  auditedUrl?: string;
}

export interface DiagnosticResult {
  id: string;
  category: 'CONTRACT' | 'INTEGRATION' | 'SYSTEM_HEALTH';
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message?: string;
  timestamp: number;
}