

export type NavigationItem = 'Dashboard' | 'AngleMiner X' | 'TestLab Pro' | 'Conversion Doctor' | 'Workflow';

export type UserTier = 'free' | 'pro';
export type UserRole = 'user' | 'super_admin' | 'ops_admin';

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

export interface SystemSettings {
  emergency_lockdown: boolean;
  last_updated: string;
  updated_by: string;
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
  timestamp: string;
  user_id: string;
  module: NavigationItem | 'System_Core';
  action: string;
  metadata?: any;
  hash: string;
  previous_hash: string;
}

export interface MarketingAngle {
  title: string;
  hook: string;
  rational: string;
  score: number;
  improved?: string;
  improving?: boolean;
}

export interface AngleMinerResults {
  prime: MarketingAngle[];
  supporting: MarketingAngle[];
  exploratory: MarketingAngle[];
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