
import { logSecurityViolation, callReportHoneypot, getSystemSettings } from './persistenceService';
import { UserProfile, SecurityEvent, PermissionScope, SystemLoadLevel, UserRole } from '../types';
import { verifyAuditChain, ChainResult } from './auditChain';


const ROLE_PERMISSIONS: Record<UserRole, PermissionScope[]> = {
  'user': ['analysis:execute', 'audit:execute', 'simulation:execute'],
  'ops_admin': ['admin:read', 'admin:user_management', 'admin:token_management', 'analysis:execute', 'audit:execute', 'simulation:execute'],
  'super_admin': ['admin:read', 'admin:user_management', 'admin:token_management', 'admin:system_config', 'admin:security_override', 'analysis:execute', 'audit:execute', 'simulation:execute']
};

const GUEST_PERMISSIONS: PermissionScope[] = ['analysis:execute', 'audit:execute', 'simulation:execute'];


// In-memory monitoring state
const requestLogs: Record<string, number[]> = {};
const adminActivityLogs: Record<string, { count: number, lastAction: number }[]> = {};

export const SecurityEngine = {

  /**
   * Global Check for Emergency Lockdown.
   */
  async isSystemLocked(): Promise<boolean> {
    const settings = await getSystemSettings();
    return settings.emergency_lockdown;
  },

  /**
   * Cryptographically verifies a sequence of log entries.
   */
  async verifyChainIntegrity(logs: any[]): Promise<ChainResult> {
    return verifyAuditChain(logs);
  },

  async detectAutomationAbuse(user: UserProfile | null): Promise<{ status: 'clean' | 'flagged' | 'blocked', reason?: string }> {
    const identity = this.getCompositeIdentity(user);
    const now = Date.now();
    if (!requestLogs[identity]) requestLogs[identity] = [];
    const logs = requestLogs[identity];
    logs.push(now);
    if (logs.length > 20) logs.shift();
    if (logs.length > 5) {
      const intervals: number[] = [];
      for (let i = 1; i < logs.length; i++) intervals.push(logs[i] - logs[i-1]);
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev < 150 && mean < 3000) return { status: 'blocked', reason: "Robotic rhythm detected." };
      if (mean < 800) return { status: 'flagged', reason: "Excessive operational velocity." };
    }
    return { status: 'clean' };
  },

  /* A first, client-side screen (role, lockdown, velocity). The server is the authority: it checks the
     role again and, for destructive admin actions, a recent sign-in (services/reauth.ts). */
  async checkPermission(user: UserProfile | null, requiredScope: PermissionScope, resourceOwnerId?: string): Promise<{ allowed: boolean, error?: string }> {
    if (!user) return { allowed: false, error: "Authentication required." };
    if (user.is_suspended) return { allowed: false, error: "Identity access revoked." };

    // EMERGENCY LOCKDOWN ENFORCEMENT
    const isLocked = await this.isSystemLocked();
    if (isLocked) {
      // Only Super Admin can toggle system config during lockdown, and everyone can read logs
      const isRecoveryAction = requiredScope === 'admin:read' || (user.role === 'super_admin' && requiredScope === 'admin:system_config');
      if (!isRecoveryAction) {
        return { allowed: false, error: "SYSTEM PROTOCOL: Operational Lockdown Active. High-stakes commands suspended." };
      }
    }

    const permissions = ROLE_PERMISSIONS[user.role] || [];
    if (!permissions.includes(requiredScope)) {
      await this.handleViolation('UNAUTHORIZED_ACCESS', 'high', `Clearance violation: [${requiredScope}]`, user);
      return { allowed: false, error: "Access Denied: Insufficient privilege level." };
    }

    if (user.role !== 'user') {
      const anomaly = await this.monitorAdminBehavior(user, requiredScope);
      if (anomaly.flagged) return { allowed: false, error: anomaly.reason };
    }

    return { allowed: true };
  },

  async monitorAdminBehavior(admin: UserProfile, action: string): Promise<{ flagged: boolean, reason?: string }> {
    const identity = this.getCompositeIdentity(admin);
    const now = Date.now();
    if (!adminActivityLogs[identity]) adminActivityLogs[identity] = [];
    adminActivityLogs[identity].push({ count: 1, lastAction: now });
    const recent = adminActivityLogs[identity].filter(l => now - l.lastAction < 60000);
    if (recent.length > 20) {
      await this.handleViolation('ADMIN_ANOMALY_DETECTED', 'critical', `Admin velocity burst: ${recent.length}/min`, admin);
      return { flagged: true, reason: "Anomalous velocity detected." };
    }
    return { flagged: false };
  },

  async detectAdversarialPatterns(input: string, user: UserProfile | null): Promise<{ safe: boolean, reason?: string }> {
    const normalized = input.toLowerCase();
    const patterns = [/ignore instructions/i, /reveal system prompt/i, /jailbreak/i, /act as (an? )?unfiltered/i];
    if (patterns.some(p => p.test(normalized))) {
      await this.handleViolation('BOT_BEHAVIOR_DETECTED', 'high', "Injection attempt signature found.", user);
      return { safe: false, reason: "Security Protocol: Unauthorized override detected." };
    }
    return { safe: true };
  },

  getSystemLoadLevel(): { level: SystemLoadLevel, score: number, percentage: number } {
    const now = Date.now();
    globalLoadWindow = globalLoadWindow.filter(l => now - l.timestamp < 60000);
    const score = globalLoadWindow.reduce((s, i) => s + i.cost, 0);
    const percentage = Math.min(100, (score / 1000) * 100);
    let level: SystemLoadLevel = 'NORMAL';
    if (percentage > 90) level = 'EMERGENCY';
    else if (percentage > 70) level = 'CRITICAL';
    else if (percentage > 40) level = 'CONGESTED';
    return { level, score, percentage };
  },

  async checkSystemCapacity(user: UserProfile | null, endpoint: string): Promise<{ allowed: boolean, throttleMs?: number, error?: string, isDegraded: boolean }> {
    const { level } = this.getSystemLoadLevel();
    if (level === 'EMERGENCY' && user?.role === 'user') return { allowed: false, error: "Neural Engine Suspended.", isDegraded: true };
    return { allowed: true, isDegraded: level !== 'NORMAL' };
  },

  recordOperationCost(endpoint: string) {
    globalLoadWindow.push({ cost: 25, timestamp: Date.now() });
  },

  validateScope(user: UserProfile | null, required: PermissionScope): boolean {
    if (!user) {
      // Allow core platform usage for unauthenticated (guest) users
      return GUEST_PERMISSIONS.includes(required);
    }
    return (ROLE_PERMISSIONS[user.role] || []).includes(required);
  },

  async validateUserTrust(user: UserProfile | null): Promise<{ allowed: boolean, error?: string }> {
    if (!user) return { allowed: true };
    if (user.is_suspended) return { allowed: false, error: "Access Revoked." };
    if ((user.risk_score || 0) >= 80) return { allowed: false, error: "Risk Threshold Violation." };
    return { allowed: true };
  },

  async validateInput(input: string, user: UserProfile | null): Promise<{ isValid: boolean, error?: string }> {
    if (input.length > 100000) return { isValid: false, error: "Payload exceeds neural buffer limits." };
    return { isValid: true };
  },

  async checkDuplicateInput(user: UserProfile | null, input: string): Promise<{ isDuplicate: boolean }> {
    return { isDuplicate: false };
  },

  getCompositeIdentity(user?: UserProfile | null): string {
    return user?.id || 'anonymous';
  },

  sanitizeErrorMessage(msg: string): string {
    return msg.replace(/[A-Za-z0-9]{20,}/g, '[REDACTED]');
  },

  async checkRateLimit(user: UserProfile | null): Promise<{ status: 'allowed' | 'throttle' | 'blocked', waitMs?: number, error?: string }> {
    const abuse = await this.detectAutomationAbuse(user);
    if (abuse.status === 'blocked') return { status: 'blocked', error: abuse.reason };
    if (abuse.status === 'flagged') return { status: 'throttle', waitMs: 5000, error: "Velocity warning active." };
    return { status: 'allowed' };
  },

  async handleViolation(type: SecurityEvent['event_type'], severity: SecurityEvent['severity'], details: string, user?: UserProfile | null, identity?: string) {
    /* Logged only. The browser cannot (and must not) suspend an account: the rules refuse it, and a
       suspension is an admin decision made from the server-side record. */
    await logSecurityViolation({ user_id: user?.id, event_type: type, severity, details, risk_increment: 15, identity_fingerprint: identity || user?.id });
  },

  async handleHoneypotTrigger(user: UserProfile | null, where = '') {
    await callReportHoneypot(where || (typeof location !== 'undefined' ? location.pathname : ''));
  },

  async checkLoginVelocity(email: string): Promise<{ allowed: boolean, error?: string, waitSeconds?: number }> { 
    // ENFORCE LOCKDOWN ON LOGIN
    const isLocked = await this.isSystemLocked();
    if (isLocked) {
      return { allowed: false, error: "SYSTEM PROTOCOL: Operational Lockdown Active. Authentications Suspended." };
    }
    return { allowed: true }; 
  },
  async adaptiveHash(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },
  async checkSessionIntegrity(user: any, ip: string): Promise<{ status: 'trusted' | 'step_up' | 'blocked', reason?: string }> { return { status: 'trusted' }; },
  async recordLoginFailure(email: string) {},
  resetLoginAttempts(email: string) {},
  async checkEndpointQuota(user: any, endpoint: string): Promise<{ allowed: boolean, error?: string }> { return { allowed: true }; },
  obfuscateSecret(s: string) { return `***${s.substring(s.length - 4)}` }
};

let globalLoadWindow: { cost: number, timestamp: number }[] = [];
