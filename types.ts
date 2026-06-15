

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

// --- PHASE 6.1: TEAM WORKSPACE ---

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  logo?: string;            // data URL or hosted URL (optional)
  owner_id: string;
  status: 'active' | 'archived';
  member_count?: number;
  extra_seats?: number;       // purchased member-seat expansions (effective cap = base + extras)
  monthly_tokens?: number;
  allocation?: number;
  consumed_this_cycle?: number;
  consumed_cycle?: string;
  created_at: string;
  updated_at?: string;
}

// Membership record. Doc id convention: `${container_id}_${uid}` (firestore.rules depend
// on this). `container_id`/`name`/`role`/`status` are the generic fields read by
// getUserMemberships across all org layers.
// Generic membership record across all org layers (workspace/agency/enterprise). Doc id
// convention: `${container_id}_${uid}`. `role` spans the families so the same shape and
// readers serve every layer.
export interface WorkspaceMember {
  id: string;
  uid: string;
  container_id: string;     // = workspace / agency / enterprise id
  name?: string;            // denormalized container name (cheap membership reads)
  email: string;
  role: WorkspaceRole | AgencyRole | EnterpriseRole;
  status: 'active' | 'invited' | 'removed';
  joined_at?: string;
  last_active?: string;
  // Agency member provisioning (Phase: member management)
  allowed_tools?: string[];        // analysis module keys the member may run (empty = all)
  token_budget?: number;           // per-cycle budget from the agency pool (0 = unlimited within pool)
  consumed_this_cycle?: number;
  consumed_cycle?: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  workspace_name: string;
  email: string;
  role: WorkspaceRole;
  invited_by: string;       // uid of inviter
  status: 'pending' | 'accepted' | 'revoked';
  created_at: string;
}

export type ActivityType =
  | 'workspace_created'
  | 'analysis_created'
  | 'report_generated'
  | 'member_added'
  | 'member_removed'
  | 'role_changed'
  | 'comment_added'
  | 'settings_updated';

export interface WorkspaceActivity {
  id: string;
  workspace_id: string;
  type: ActivityType;
  actor_uid: string;
  actor_name?: string;
  summary: string;
  created_at: string;       // ISO
}

export interface WorkspaceComment {
  id: string;
  workspace_id: string;
  analysis_id: string;
  parent_id?: string | null; // set for replies
  author_uid: string;
  author_name?: string;
  content: string;
  created_at: string;       // ISO
  updated_at?: string;
}

// --- PHASE 6.2: AGENCY CLIENT MANAGER ---
// An Agency contains Clients. Each client's intelligence is isolated via the `client`
// visibility/scope from Phase 6.0 (analyses stamp client_id + agency_id). Agency members
// access a client only when they are the owner/director OR assigned to it.

export type AgencyClientStatus = 'active' | 'growing' | 'at_risk' | 'inactive' | 'archived';
export type ClientAssignmentRole = 'account_manager' | 'strategist' | 'analyst' | 'support';

export interface Agency {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  owner_id: string;
  status: 'active' | 'archived';
  client_count?: number;
  member_count?: number;
  extra_workspaces?: number;  // purchased workspace expansions
  extra_members?: number;     // purchased member-seat expansions
  enterprise_allocation?: number; // token budget assigned by a parent enterprise
  created_at: string;
  updated_at?: string;
}

export interface AgencyClient {
  id: string;
  agency_id: string;
  name: string;
  industry?: string;
  website?: string;
  description?: string;
  primary_contact?: string;
  email?: string;
  phone?: string;
  status: AgencyClientStatus;
  tags?: string[];
  analysis_count?: number;
  last_activity?: string;
  // Token budgeting (Phase 4): allocation = per-cycle cap (0 = uncapped); consumed tracked per cycle.
  allocation?: number;
  consumed_this_cycle?: number;
  consumed_cycle?: string;
  created_at: string;
  updated_at?: string;
}

// Agencies/enterprises also carry an `enterprise_allocation` cap when nested under an enterprise.

// Doc id convention: `${client_id}_${uid}` (firestore.rules depends on it).
export interface ClientAssignment {
  id: string;
  client_id: string;
  agency_id: string;
  uid: string;
  email: string;
  assignment_role: ClientAssignmentRole;
  created_at: string;
}

export interface ClientNote {
  id: string;
  client_id: string;
  agency_id: string;
  author_uid: string;
  author_name?: string;
  content: string;
  pinned?: boolean;
  tags?: string[];
  created_at: string;
  updated_at?: string;
}

export interface ClientActivity {
  id: string;
  client_id: string;
  agency_id: string;
  type: string;             // client_created | analysis_created | note_added | member_assigned | ...
  actor_uid: string;
  actor_name?: string;
  summary: string;
  created_at: string;
}

export interface AgencyInvitation {
  id: string;
  agency_id: string;
  agency_name: string;
  email: string;
  role: AgencyRole;
  invited_by: string;
  status: 'pending' | 'accepted' | 'revoked';
  created_at: string;
}

// --- PHASE 6.3: ENTERPRISE ANALYTICS SUITE ---
// The highest layer. READ-ONLY aggregation: it summarizes intelligence across teams/agencies
// but NEVER mutates underlying analyses/reports. The Enterprise Analytics Engine (server)
// writes the snapshot/health/forecast/briefing docs the UI reads.

export type EnterpriseHealthBand = 'critical' | 'weak' | 'stable' | 'strong' | 'excellent';
export type BriefingPeriod = 'weekly' | 'monthly' | 'quarterly' | 'annual';

export interface Enterprise {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  owner_id: string;
  status: 'active' | 'archived';
  member_count?: number;
  department_count?: number;
  brand_count?: number;
  extra_agencies?: number;    // purchased agency-slot expansions
  extra_members?: number;     // purchased member-seat expansions
  // Containers the enterprise aggregates over (registered by the owner).
  linked_workspaces?: string[];
  linked_agencies?: string[];
  created_at: string;
  updated_at?: string;
}

export interface EnterpriseDepartment {
  id: string;
  enterprise_id: string;
  name: string;
  type?: string;            // Marketing | Sales | Operations | Strategy | Product | ...
  linked_workspaces?: string[];
  linked_agencies?: string[];
  created_at: string;
}

export interface EnterpriseBrand {
  id: string;
  enterprise_id: string;
  name: string;
  description?: string;
  linked_workspaces?: string[];
  linked_agencies?: string[];
  created_at: string;
}

// Engine outputs (server-written; UI reads these, never raw cross-tenant data).
export interface EnterpriseHealthScore {
  id: string;
  enterprise_id: string;
  score: number;            // 0–100
  band: EnterpriseHealthBand;
  signals: { label: string; value: number }[];
  computed_at: string;
}

export interface EnterpriseAnalyticsSnapshot {
  id: string;
  enterprise_id: string;
  total_analyses: number;
  total_reports: number;
  active_users: number;
  by_module: { module: string; count: number }[];
  by_department?: { department: string; count: number }[];
  computed_at: string;
}

export interface EnterpriseForecast {
  id: string;
  enterprise_id: string;
  type: string;             // revenue | growth | activity | expansion
  label: string;
  projection: string;       // human-readable projection
  trend: 'up' | 'flat' | 'down';
  computed_at: string;
}

export interface EnterpriseBriefing {
  id: string;
  enterprise_id: string;
  period: BriefingPeriod;
  title: string;
  summary: string;
  wins: string[];
  risks: string[];
  opportunities: string[];
  recommendations: string[];
  created_at: string;
  created_by: string;
}

export interface EnterpriseInvitation {
  id: string;
  enterprise_id: string;
  enterprise_name: string;
  email: string;
  role: EnterpriseRole;
  invited_by: string;
  status: 'pending' | 'accepted' | 'revoked';
  created_at: string;
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
// A result point is either a plain string (legacy/simple) or a structured insight card.
export interface StructuredResultItem {
  insight: string;     // the finding/point itself
  evidence?: string;   // why it matters — the reasoning or signal behind it
  action?: string;     // the specific recommended move
}
export type ResultItem = string | StructuredResultItem;

export interface AnalysisSection {
  title: string;
  items: ResultItem[];
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
  tokens: number;                 // mirror = monthly_tokens + purchased_tokens (back-compat)
  monthly_tokens?: number;        // included allowance; resets each billing cycle
  purchased_tokens?: number;      // bought via token packs; never expire
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
  // Profile / account (client-editable via Settings — NOT economy/authority fields).
  first_name?: string;
  last_name?: string;
  company_name?: string;
  job_title?: string;
  bio?: string;
  username?: string;
  timezone?: string;
  language?: string;
  avatar_url?: string;
  notification_prefs?: NotificationPrefs;
}

// Per-category notification opt-ins (stored on the user doc, edited in Settings → Notifications).
export interface NotificationPrefs {
  analysis?: boolean;   // analysis complete
  token?: boolean;      // token / balance alerts
  product?: boolean;    // product updates
  workspace?: boolean;  // workspace / org events
  email?: boolean;      // email channel master switch
}

// The exact set of profile fields a client may write to its own /users doc. Mirrors the
// firestore.rules allowlist — economy/authority fields are NEVER in here.
export const EDITABLE_PROFILE_FIELDS = [
  'first_name', 'last_name', 'company_name', 'job_title', 'bio',
  'username', 'timezone', 'language', 'avatar_url', 'notification_prefs',
] as const;

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
  severity?: string;   // 'Critical' | 'High' | 'Medium' | 'Low'
}

export interface AuditFix {
  what: string;
  how: string;
  expectedResult: string;
  priority?: string;   // 'High' | 'Medium' | 'Low' — what to do first
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