import { db, isFirebaseInitialized, functions } from './firebase';
import { DEFAULT_PRICING_CONFIG } from '../config/pricingConfig';
import { httpsCallable } from 'firebase/functions';
import { 
  collection, 
  addDoc, 
  getDoc, 
  getDocs, 
  doc, 
  query, 
  orderBy, 
  limit, 
  updateDoc,
  setDoc,
  deleteDoc,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  where
} from 'firebase/firestore';
import { 
  AngleMinerResults, 
  TestLabResults, 
  AuditResult, 
  UserProfile, 
  SystemSettings,
  AuditLogEntry, 
  SecurityEvent,
  ActionLogEntry,
  AdminSettings,
  PaymentRecord,
  AppNotification,
  NotificationCategory,
  Scope,
  ScopeLevel,
  VisibilityType,
  OwnershipStamp,
  UserMembership,
  Report,
  Workspace,
  WorkspaceMember,
  WorkspaceActivity,
  WorkspaceComment,
  WorkspaceInvitation,
  WorkspaceRole,
  ActivityType,
  Agency,
  AgencyClient,
  ClientAssignment,
  ClientNote,
  ClientActivity,
  AgencyInvitation,
  Enterprise,
  EnterpriseDepartment,
  EnterpriseBrand,
  EnterpriseHealthScore,
  EnterpriseAnalyticsSnapshot,
  EnterpriseForecast,
  EnterpriseBriefing,
  EnterpriseInvitation,
  BriefingPeriod,
  EDITABLE_PROFILE_FIELDS
} from '../types';
import { SecurityEngine } from './securityEngine';

// TOKEN_COSTS REMOVED: Pricing is now strictly enforced server-side.

const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

const generateHash = async (content: string, prevHash: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(content + prevHash);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Safe wrapper for Firestore queries
const safeGetLastHash = async (table: string): Promise<string> => {
  if (!isFirebaseInitialized) return GENESIS_HASH;
  try {
    const q = query(collection(db, table), orderBy('timestamp', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data().hash;
    }
  } catch { /* ignore */ }
  return GENESIS_HASH;
};

export const getSystemSettings = async (): Promise<SystemSettings> => {
  if (!isFirebaseInitialized) return { emergency_lockdown: false, last_updated: new Date().toISOString(), updated_by: 'system' };
  try {
    const docRef = doc(db, 'system_settings', 'global');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as SystemSettings;
    }
  } catch (e: any) {
    // Suppress offline errors to prevent console noise
    const msg = e.message || '';
    if (e.code === 'unavailable' || msg.includes('offline')) {
      // System is offline, return default safe settings
    } else {
      console.error("Failed to load settings", e);
    }
  }
  return { emergency_lockdown: false, last_updated: new Date().toISOString(), updated_by: 'system' };
};

export const getAdminSettings = async (): Promise<AdminSettings> => {
  const defaultSettings: AdminSettings = {
    maintenance_mode: false,
    analyses_paused: false,
    modules_enabled: {
      // Original bespoke tools
      AngleMiner: true,
      ConversionDoctor: true,
      TestLabPro: true,
      Workflow: true,
      // Generic §14–22 tools (keys match MODULE_MAPPING values in functions/src/index.ts)
      StrategyLab: true,
      OfferAnalyzer: true,
      AudienceIntel: true,
      MarketIntel: true,
      Competitor: true,
      Messaging: true,
      ContentStrategy: true,
      Campaign: true,
      Growth: true,
      WorkflowAnalyzer: true
    }
  };

  if (!isFirebaseInitialized) return defaultSettings;
  
  try {
    const docRef = doc(db, 'admin_settings', 'global');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as Partial<AdminSettings>;
      return {
        ...defaultSettings,
        ...data,
        modules_enabled: { ...defaultSettings.modules_enabled, ...(data.modules_enabled || {}) }
      };
    }
  } catch (e) {
    console.error("Failed to load admin settings", e);
  }
  return defaultSettings;
};

export const callUpdateSystemSettings = async (changes: Partial<AdminSettings>) => {
  if (!isFirebaseInitialized) throw new Error("Connection failed");
  const updateSystemSettings = httpsCallable(functions, 'updateSystemSettings');
  try {
    const result = await updateSystemSettings({ changes });
    return result.data;
  } catch (error: any) {
    throw new Error(error.message || "Settings update failed on server.");
  }
};

export const callConfirmTopUp = async (paymentReference: string, packId?: string) => {
  if (!isFirebaseInitialized) throw new Error("Connection failed");
  const confirmTopUp = httpsCallable(functions, 'confirmTopUp');
  try {
    // Server resolves the pack (price/tokens) from the live pricing config and credits purchased tokens.
    const result = await confirmTopUp({ paymentReference, packId });
    return result.data;
  } catch (error: any) {
    throw new Error(error.message || "Top-up failed.");
  }
};

// Hierarchical token allocation — agency owner caps a client's budget (level 'client'); enterprise
// owner caps an agency's budget (level 'agency'). amount 0 = uncapped (draws freely from the pool).
export const callAllocateTokens = async (params: {
  level: 'client' | 'agency'; agencyId?: string; clientId?: string; enterpriseId?: string; amount: number;
}) => {
  if (!isFirebaseInitialized) throw new Error("Connection failed");
  const fn = httpsCallable(functions, 'allocateTokens');
  try {
    const result = await fn(params);
    return result.data as { success: boolean; allocation: number; poolRemaining: number };
  } catch (error: any) {
    throw new Error(error.message || "Allocation failed.");
  }
};

// Paid expansion — raise an org container's capacity (extra seat / workspace / agency). Simulated.
export const callPurchaseExpansion = async (params: {
  type: 'member' | 'workspace' | 'agency'; level: 'workspace' | 'agency' | 'enterprise'; containerId: string;
}) => {
  if (!isFirebaseInitialized) throw new Error("Connection failed");
  const fn = httpsCallable(functions, 'purchaseExpansion');
  try {
    const result = await fn(params);
    return result.data as { success: boolean; type: string; field: string; price: number };
  } catch (error: any) {
    throw new Error(error.message || "Expansion purchase failed.");
  }
};

// §30 Subscription lifecycle — server-authoritative state transitions.
export const callChangeSubscription = async (action: 'upgrade' | 'cancel' | 'downgrade' | 'renew') => {
  if (!isFirebaseInitialized) throw new Error("Connection failed");
  const changeSubscription = httpsCallable(functions, 'changeSubscription');
  try {
    const result = await changeSubscription({ action });
    return result.data as { success: boolean; status?: string; plan_renews_at?: string };
  } catch (error: any) {
    throw new Error(error.message || "Subscription change failed.");
  }
};

export const updateSystemEmergency = async (admin: UserProfile, active: boolean) => {
  if (!isFirebaseInitialized) throw new Error("Database not connected");
  const now = new Date().toISOString();
  const docRef = doc(db, 'system_settings', 'global');
  
  await setDoc(docRef, { 
    emergency_lockdown: active, 
    last_updated: now, 
    updated_by: admin.email 
  }, { merge: true });
  
  await SecurityEngine.handleViolation(
    active ? 'SYSTEM_EMERGENCY_ACTIVATED' : 'SYSTEM_EMERGENCY_DEACTIVATED',
    'critical',
    `System emergency state toggled to ${active ? 'ACTIVE' : 'INACTIVE'} by admin.`,
    admin
  );
  // Log locally for immediate feedback, though server should also log critical events
  await logAdminAction(admin, active ? 'LOCKDOWN_ACTIVATED' : 'LOCKDOWN_RELEASED', 'GLOBAL_SYSTEM');
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!isFirebaseInitialized) return null;
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    
    const data = docSnap.data();
    return {
      id: userId,
      email: data.email,
      tokens: data.tokens,
      tier: data.tier,
      role: data.email === 'admin@marketbrainos.com' ? 'super_admin' : (data.role || 'user'),
      session_started: data.session_started || new Date().toISOString(),
      last_active: data.last_active,
      risk_score: data.risk_score,
      is_suspended: data.is_suspended,
      suspension_reason: data.suspension_reason,
      bot_confidence_score: data.bot_confidence_score,
      is_verified_admin: data.is_verified_admin,
      last_verification: data.last_verification,
      onboarded: data.onboarded ?? false,
      subscription_status: data.subscription_status || (data.tier === 'pro' ? 'active' : 'free'),
      plan_renews_at: data.plan_renews_at,
      subscription_started_at: data.subscription_started_at,
      // Profile / account fields (client-editable via Settings)
      first_name: data.first_name,
      last_name: data.last_name,
      company_name: data.company_name,
      job_title: data.job_title,
      bio: data.bio,
      username: data.username,
      timezone: data.timezone,
      language: data.language,
      avatar_url: data.avatar_url,
      notification_prefs: data.notification_prefs,
    };
  } catch { return null; }
};

// Update the caller's own profile fields. Writes ONLY the allowlisted profile/preference fields
// (EDITABLE_PROFILE_FIELDS) — economy/authority fields are server-only and rejected by rules.
export const updateUserProfile = async (
  userId: string,
  fields: Partial<Pick<UserProfile,
    'first_name' | 'last_name' | 'company_name' | 'job_title' | 'bio' |
    'username' | 'timezone' | 'language' | 'avatar_url' | 'notification_prefs'>>
): Promise<void> => {
  if (!isFirebaseInitialized) throw new Error('Database not connected');
  const allowed: Record<string, any> = {};
  for (const key of EDITABLE_PROFILE_FIELDS) {
    if (key in fields && (fields as any)[key] !== undefined) allowed[key] = (fields as any)[key];
  }
  if (Object.keys(allowed).length === 0) return;
  await updateDoc(doc(db, 'users', userId), allowed);
};

export const setOnboarded = async (userId: string) => {
  if (!isFirebaseInitialized) return;
  try { await updateDoc(doc(db, 'users', userId), { onboarded: true }); } catch (e) { console.error(e); }
};

export const replayOnboarding = async (userId: string) => {
  if (!isFirebaseInitialized) return;
  try { await updateDoc(doc(db, 'users', userId), { onboarded: false }); } catch (e) { console.error(e); }
};

const FREE_MONTHLY_TOKENS = DEFAULT_PRICING_CONFIG.plans.free.monthlyTokens;

export const ensureUserProfile = async (userId: string, email: string) => {
  if (!isFirebaseInitialized) return;
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    await setDoc(docRef, {
      id: userId,
      email: email,
      // Free plan monthly allocation (resets each cycle). Mirror `tokens` = monthly + purchased.
      tokens: FREE_MONTHLY_TOKENS,
      monthly_tokens: FREE_MONTHLY_TOKENS,
      purchased_tokens: 0,
      tier: 'free',
      role: email === 'admin@marketbrainos.com' ? 'super_admin' : 'user',
      onboarded: false,
      subscription_status: 'free',
      // Renewal date so the free monthly allowance cycles via monthlyTokenRefresh.
      plan_renews_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString()
    });
  } else {
    await updateDoc(docRef, { last_active: new Date().toISOString() });
  }
};

export const logUserAction = async (entry: Omit<ActionLogEntry, 'id' | 'timestamp' | 'hash' | 'previous_hash'>) => {
  if (!isFirebaseInitialized) return;
  const prevHash = await safeGetLastHash('action_logs');
  const timestamp = new Date().toISOString();
  // Safe serialization to prevent Firestore unsupported value errors
  const content = JSON.stringify({ ...entry, timestamp });
  const hash = await generateHash(content, prevHash);
  
  await addDoc(collection(db, 'action_logs'), { ...entry, timestamp, previous_hash: prevHash, hash });
};

export const logExecutionTrace = async (trace: any) => {
  // Convert custom class instances to plain objects to satisfy Firestore requirements
  let safeTrace: any;
  try {
    safeTrace = JSON.parse(JSON.stringify(trace));
  } catch (e) {
    safeTrace = { error: "Trace serialization failed", traceId: trace?.id, operation: trace?.operation };
  }

  await logUserAction({
    user_id: trace.userId,
    module: 'System_Core', 
    action: `EXECUTION_TRACE:${trace.operation?.toUpperCase() || 'UNKNOWN'}`,
    metadata: {
      trace_id: trace.id,
      status: trace.status,
      duration_ms: trace.timestamp ? Date.now() - trace.timestamp : 0,
      steps_count: trace.steps ? trace.steps.length : 0,
      full_trace: safeTrace 
    }
  });
};

export const logSecurityViolation = async (event: Omit<SecurityEvent, 'id' | 'timestamp' | 'hash' | 'previous_hash'>) => {
  if (!isFirebaseInitialized) return;
  const prevHash = await safeGetLastHash('security_audit_logs');
  const timestamp = new Date().toISOString();
  const content = JSON.stringify({ ...event, timestamp });
  const hash = await generateHash(content, prevHash);
  
  await addDoc(collection(db, 'security_audit_logs'), { ...event, timestamp, previous_hash: prevHash, hash });
};

// Best-effort client-side audit breadcrumb. The authoritative, tamper-evident audit trail is
// written SERVER-SIDE by logAdminAudit (Cloud Functions); admin_audit_logs is server-only by
// security rules, so this client write may be denied — and that's fine. It must NEVER throw or it
// would abort the caller (e.g. the step-up verify→execute flow would skip the actual mutation).
export const logAdminAction = async (admin: UserProfile, action: string, target: string, metadata?: any) => {
  if (!isFirebaseInitialized) return;
  try {
    // Firestore rejects `undefined`; strip it and default to {} so addDoc never fails on shape.
    const safeMetadata = JSON.parse(JSON.stringify(metadata ?? {}));
    const prevHash = await safeGetLastHash('admin_audit_logs');
    const timestamp = new Date().toISOString();
    const entry = { admin_email: admin.email, admin_role: admin.role, action_type: action, target, metadata: safeMetadata };
    const content = JSON.stringify({ ...entry, timestamp });
    const hash = await generateHash(content, prevHash);

    await addDoc(collection(db, 'admin_audit_logs'), { ...entry, timestamp, previous_hash: prevHash, hash });
  } catch (e) {
    console.warn('logAdminAction (client breadcrumb) skipped:', e);
  }
};

// --- ARTIFACT PERSISTENCE ---

export const saveAngleMinerResult = async (userId: string, product: string, industry: string, target: string, results: AngleMinerResults) => {
  if (!isFirebaseInitialized) return { id: 'mock_id', ...results };
  await logUserAction({ user_id: userId, module: 'AngleMiner X', action: 'SAVE_ARTIFACT' });
  
  const docRef = await addDoc(collection(db, 'angleminer_results'), {
    user_id: userId, 
    industry, 
    target_audience: target, 
    angles_output: results,
    timestamp: new Date().toISOString()
  });
  
  return { id: docRef.id, ...results };
};

export const deleteAngleMinerResult = async (id: string) => {
  if (!isFirebaseInitialized) return;
  await deleteDoc(doc(db, 'angleminer_results', id));
};

export const saveTestLabResult = async (userId: string, type: string, variants: string[], results: TestLabResults) => {
  if (!isFirebaseInitialized) return { id: 'mock_id', ...results };
  await logUserAction({ user_id: userId, module: 'TestLab Pro', action: 'SAVE_ARTIFACT' });
  
  const docRef = await addDoc(collection(db, 'testlab_results'), {
    user_id: userId, 
    comparison_type: type, 
    winner: results.winnerLabel,
    results,
    timestamp: new Date().toISOString()
  });
  
  return { id: docRef.id, ...results };
};

export const deleteTestLabResult = async (id: string) => {
  if (!isFirebaseInitialized) return;
  await deleteDoc(doc(db, 'testlab_results', id));
};

export const saveConversionDoctorResult = async (userId: string, input: string, score: number, result: AuditResult) => {
  if (!isFirebaseInitialized) return { id: 'mock_id', ...result };
  await logUserAction({ user_id: userId, module: 'Conversion Doctor', action: 'SAVE_ARTIFACT' });
  
  const docRef = await addDoc(collection(db, 'conversion_doctor_results'), {
    user_id: userId, 
    conversion_score: score, 
    audit_output: result,
    timestamp: new Date().toISOString()
  });
  
  return { id: docRef.id, ...result };
};

export const deleteConversionDoctorResult = async (id: string) => {
  if (!isFirebaseInitialized) return;
  await deleteDoc(doc(db, 'conversion_doctor_results', id));
};

export const saveWorkflowRun = async (userId: string, angle: string, testScore: number, conversionScore: number, finalOutput: any) => {
  if (!isFirebaseInitialized) return { id: 'mock_id', ...finalOutput };
  await logUserAction({ user_id: userId, module: 'Workflow', action: 'SAVE_ARTIFACT' });
  
  const docRef = await addDoc(collection(db, 'workflow_runs'), {
    user_id: userId, 
    selected_angle: angle, 
    final_output: finalOutput,
    timestamp: new Date().toISOString()
  });
  
  return { id: docRef.id, ...finalOutput };
};

export const deleteWorkflowRun = async (id: string) => {
  if (!isFirebaseInitialized) return;
  await deleteDoc(doc(db, 'workflow_runs', id));
};

// Generic persistence for the PRD §14–22 analysis tools.
// Stores under 'tool_analysis_results' keyed by module for a unified history view.
// Phase 6: derive the ownership stamp from the active scope. 'personal' (the V1 default)
// yields a private, creator-only record — identical visibility to pre-Phase-6 behavior.
export const scopeToOwnership = (userId: string, scope?: Scope): OwnershipStamp => {
  const s = scope || { level: 'personal' as ScopeLevel };
  const visibility: VisibilityType =
    s.level === 'team' ? 'team' :
    s.level === 'client' ? 'client' :
    s.level === 'enterprise' ? 'enterprise' : 'private';
  return {
    creator_user_id: userId,
    visibility_type: visibility,
    workspace_id: s.workspaceId ?? null,
    agency_id: s.agencyId ?? null,
    client_id: s.clientId ?? null,
    enterprise_id: s.enterpriseId ?? null,
  };
};

export const saveGenericAnalysis = async (
  userId: string,
  module: string,
  inputs: Record<string, string>,
  result: any,
  scope?: Scope
) => {
  if (!isFirebaseInitialized) return { id: 'mock_id', ...result };
  await logUserAction({ user_id: userId, module, action: 'SAVE_ARTIFACT' });

  const ownership = scopeToOwnership(userId, scope);
  const docRef = await addDoc(collection(db, 'tool_analysis_results'), {
    user_id: userId,            // retained for V1 readers/back-compat
    module,
    inputs,
    result,
    timestamp: new Date().toISOString(),
    ...ownership,               // creator_user_id + visibility_type + *_id stamp
  });

  return { id: docRef.id, ...result };
};

export const deleteGenericAnalysis = async (id: string) => {
  if (!isFirebaseInitialized) return;
  await deleteDoc(doc(db, 'tool_analysis_results', id));
};

export interface ToolAnalysisRecord {
  id: string;
  module: string;
  inputs: Record<string, string>;
  result: any;
  timestamp: string;
}

// Reads a user's saved generic-tool analyses for the connected-ecosystem context picker.
// Sorted newest-first client-side to avoid composite-index requirements.
// This is the PERSONAL-scope case (creator's own records) and remains the V1 behavior.
export const getUserToolAnalyses = async (userId: string): Promise<ToolAnalysisRecord[]> => {
  if (!isFirebaseInitialized) return [];
  try {
    const q = query(collection(db, 'tool_analysis_results'), where('user_id', '==', userId));
    const snapshot = await getDocs(q);
    const rows = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as ToolAnalysisRecord[];
    return rows.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  } catch (e) {
    console.error('Failed to fetch tool analyses', e);
    return [];
  }
};

// Phase 6: the UNIFIED analysis-history reader. Returns the records visible in a given
// scope. 'personal' === getUserToolAnalyses (own records, incl. legacy un-stamped docs);
// team/client/enterprise scopes filter by the corresponding container id. Server-side
// firestore.rules enforce that the caller is actually a member of that container — this
// reader assumes membership has already been established by ScopeContext.
export const getAnalysesForScope = async (userId: string, scope: Scope): Promise<ToolAnalysisRecord[]> => {
  if (!isFirebaseInitialized) return [];
  if (scope.level === 'personal') return getUserToolAnalyses(userId);
  try {
    const col = collection(db, 'tool_analysis_results');
    let q;
    if (scope.level === 'team' && scope.workspaceId) {
      q = query(col, where('workspace_id', '==', scope.workspaceId), where('visibility_type', '==', 'team'));
    } else if (scope.level === 'client' && scope.clientId && scope.agencyId) {
      // agency_id constraint makes the rule (isAgencyMember(agency_id)) query-constant so the list is allowed.
      q = query(col, where('agency_id', '==', scope.agencyId), where('client_id', '==', scope.clientId), where('visibility_type', '==', 'client'));
    } else if (scope.level === 'enterprise' && scope.enterpriseId) {
      q = query(col, where('enterprise_id', '==', scope.enterpriseId), where('visibility_type', '==', 'enterprise'));
    } else {
      return [];
    }
    const snapshot = await getDocs(q);
    const rows = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as ToolAnalysisRecord[];
    return rows.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  } catch (e) {
    console.error('Failed to fetch scoped analyses', e);
    return [];
  }
};

// Phase 6: UNIFIED reporting engine (one collection, same ownership stamp as analyses).
export const saveReport = async (
  userId: string,
  report: { title: string; report_type: string; content: any },
  scope?: Scope
): Promise<Report> => {
  const ownership = scopeToOwnership(userId, scope);
  const doc: Report = {
    title: report.title,
    report_type: report.report_type,
    content: report.content,
    created_at: new Date().toISOString(),
    ...ownership,
  };
  if (!isFirebaseInitialized) return { id: 'mock_report', ...doc };
  const ref = await addDoc(collection(db, 'reports'), doc as any);
  return { id: ref.id, ...doc };
};

export const deleteReport = async (id: string) => {
  if (!isFirebaseInitialized) return;
  await deleteDoc(doc(db, 'reports', id));
};

// Reports visible in a given scope — mirrors getAnalysesForScope.
export const getReportsForScope = async (userId: string, scope: Scope): Promise<Report[]> => {
  if (!isFirebaseInitialized) return [];
  try {
    const col = collection(db, 'reports');
    let q;
    if (scope.level === 'personal') {
      q = query(col, where('creator_user_id', '==', userId));
    } else if (scope.level === 'team' && scope.workspaceId) {
      q = query(col, where('workspace_id', '==', scope.workspaceId), where('visibility_type', '==', 'team'));
    } else if (scope.level === 'client' && scope.clientId && scope.agencyId) {
      q = query(col, where('agency_id', '==', scope.agencyId), where('client_id', '==', scope.clientId), where('visibility_type', '==', 'client'));
    } else if (scope.level === 'enterprise' && scope.enterpriseId) {
      q = query(col, where('enterprise_id', '==', scope.enterpriseId), where('visibility_type', '==', 'enterprise'));
    } else {
      return [];
    }
    const snapshot = await getDocs(q);
    const rows = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Report[];
    return rows.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  } catch (e) {
    console.error('Failed to fetch scoped reports', e);
    return [];
  }
};

// Phase 6: every container the user belongs to, across all org layers. Member docs
// denormalize {container_id, role, name} for cheap reads. Until the Team/Agency/Enterprise
// collections exist (6.1+), these queries simply return empty — safe no-op for V1 users.
export const getUserMemberships = async (userId: string): Promise<UserMembership[]> => {
  if (!isFirebaseInitialized || !userId) return [];
  const out: UserMembership[] = [];
  const sources: { coll: string; family: UserMembership['family'] }[] = [
    { coll: 'workspace_members', family: 'workspace' },
    { coll: 'agency_members', family: 'agency' },
    { coll: 'enterprise_members', family: 'enterprise' },
  ];
  for (const { coll, family } of sources) {
    try {
      const snap = await getDocs(query(collection(db, coll), where('uid', '==', userId)));
      snap.forEach(d => {
        const data: any = d.data();
        if (data.status && data.status !== 'active') return; // skip pending/removed invites
        out.push({
          family,
          containerId: data.container_id,
          name: data.name || 'Workspace',
          role: data.role,
          agencyId: data.agency_id,
        });
      });
    } catch (e) {
      // Collection may not exist yet, or rules deny — treat as no memberships.
      console.error(`Failed to read ${coll}`, e);
    }
  }
  return out;
};

// ============================================================
// PHASE 6.1 — TEAM WORKSPACE DATA LAYER
// Privileged mutations (create workspace, invite/role/remove) go through Cloud Functions
// (callables below); reads + collaborative writes (comments, activity) use the client SDK
// under firestore.rules membership enforcement.
// ============================================================

export const getWorkspace = async (workspaceId: string): Promise<Workspace | null> => {
  if (!isFirebaseInitialized || !workspaceId) return null;
  try {
    const snap = await getDoc(doc(db, 'workspaces', workspaceId));
    return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Workspace) : null;
  } catch (e) { console.error('Failed to load workspace', e); return null; }
};

export const getWorkspaceMembers = async (workspaceId: string): Promise<WorkspaceMember[]> => {
  if (!isFirebaseInitialized || !workspaceId) return [];
  try {
    const snap = await getDocs(query(collection(db, 'workspace_members'), where('container_id', '==', workspaceId)));
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }) as WorkspaceMember)
      .filter(m => m.status !== 'removed')
      .sort((a, b) => (a.email || '').localeCompare(b.email || ''));
  } catch (e) { console.error('Failed to load members', e); return []; }
};

export const getWorkspaceActivity = async (workspaceId: string, max = 50): Promise<WorkspaceActivity[]> => {
  if (!isFirebaseInitialized || !workspaceId) return [];
  try {
    const snap = await getDocs(query(collection(db, 'workspace_activity'), where('workspace_id', '==', workspaceId)));
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }) as WorkspaceActivity)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, max);
  } catch (e) { console.error('Failed to load activity', e); return []; }
};

// Members log their own activity (rules permit create when actor_uid === auth.uid).
export const logWorkspaceActivity = async (
  workspaceId: string,
  type: ActivityType,
  actorUid: string,
  actorName: string,
  summary: string
): Promise<void> => {
  if (!isFirebaseInitialized || !workspaceId) return;
  try {
    await addDoc(collection(db, 'workspace_activity'), {
      workspace_id: workspaceId, type, actor_uid: actorUid, actor_name: actorName,
      summary, created_at: new Date().toISOString(),
    });
  } catch (e) { console.error('Failed to log activity', e); }
};

// --- Comments on shared analyses ---
export const getAnalysisComments = async (workspaceId: string, analysisId: string): Promise<WorkspaceComment[]> => {
  if (!isFirebaseInitialized) return [];
  try {
    const snap = await getDocs(query(
      collection(db, 'workspace_comments'),
      where('workspace_id', '==', workspaceId),
      where('analysis_id', '==', analysisId),
    ));
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }) as WorkspaceComment)
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  } catch (e) { console.error('Failed to load comments', e); return []; }
};

export const createWorkspaceComment = async (
  c: { workspace_id: string; analysis_id: string; parent_id?: string | null; author_uid: string; author_name?: string; content: string }
): Promise<WorkspaceComment | null> => {
  if (!isFirebaseInitialized) return null;
  try {
    const data = { ...c, parent_id: c.parent_id ?? null, created_at: new Date().toISOString() };
    const ref = await addDoc(collection(db, 'workspace_comments'), data);
    return { id: ref.id, ...data } as WorkspaceComment;
  } catch (e) { console.error('Failed to add comment', e); return null; }
};

export const updateWorkspaceComment = async (id: string, content: string): Promise<void> => {
  if (!isFirebaseInitialized) return;
  try { await updateDoc(doc(db, 'workspace_comments', id), { content, updated_at: new Date().toISOString() }); }
  catch (e) { console.error('Failed to edit comment', e); }
};

export const deleteWorkspaceComment = async (id: string): Promise<void> => {
  if (!isFirebaseInitialized) return;
  try { await deleteDoc(doc(db, 'workspace_comments', id)); } catch (e) { console.error('Failed to delete comment', e); }
};

// --- Invitations (the invitee sees pending invites on login and accepts) ---
export const getPendingInvitations = async (email: string): Promise<WorkspaceInvitation[]> => {
  if (!isFirebaseInitialized || !email) return [];
  try {
    const snap = await getDocs(query(
      collection(db, 'workspace_invitations'),
      where('email', '==', email.toLowerCase()),
      where('status', '==', 'pending'),
    ));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as WorkspaceInvitation);
  } catch (e) { console.error('Failed to load invitations', e); return []; }
};

// --- Privileged mutations via Cloud Functions (server-enforced) ---
export const callManageWorkspace = async (
  action: 'create' | 'update' | 'delete' | 'transfer',
  payload: any
) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  const fn = httpsCallable(functions, 'manageWorkspace');
  try { return (await fn({ action, payload })).data as any; }
  catch (error: any) { throw new Error(error.message || 'Workspace action failed.'); }
};

export const callManageMembership = async (
  action: 'invite' | 'accept' | 'updateRole' | 'remove' | 'revoke',
  payload: any
) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  const fn = httpsCallable(functions, 'manageMembership');
  try { return (await fn({ action, payload })).data as any; }
  catch (error: any) { throw new Error(error.message || 'Membership action failed.'); }
};

// ============================================================
// PHASE 6.2 — AGENCY CLIENT MANAGER DATA LAYER
// ============================================================

export const getAgency = async (agencyId: string): Promise<Agency | null> => {
  if (!isFirebaseInitialized || !agencyId) return null;
  try {
    const snap = await getDoc(doc(db, 'agencies', agencyId));
    return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Agency) : null;
  } catch (e) { console.error('Failed to load agency', e); return null; }
};

export const getAgencyClients = async (agencyId: string): Promise<AgencyClient[]> => {
  if (!isFirebaseInitialized || !agencyId) return [];
  try {
    const snap = await getDocs(query(collection(db, 'agency_clients'), where('agency_id', '==', agencyId)));
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }) as AgencyClient)
      .filter(c => c.status !== 'archived')
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (e) { console.error('Failed to load clients', e); return []; }
};

export const getClient = async (clientId: string): Promise<AgencyClient | null> => {
  if (!isFirebaseInitialized || !clientId) return null;
  try {
    const snap = await getDoc(doc(db, 'agency_clients', clientId));
    return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as AgencyClient) : null;
  } catch (e) { console.error('Failed to load client', e); return null; }
};

export const getClientAssignments = async (clientId: string, agencyId?: string): Promise<ClientAssignment[]> => {
  if (!isFirebaseInitialized || !clientId) return [];
  try {
    const base = collection(db, 'client_assignments');
    // agency_id constraint makes the read rule (isAgencyMember(agency_id)) query-constant.
    const q = agencyId
      ? query(base, where('agency_id', '==', agencyId), where('client_id', '==', clientId))
      : query(base, where('client_id', '==', clientId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as ClientAssignment);
  } catch (e) { console.error('Failed to load assignments', e); return []; }
};

// Clients the current user is explicitly assigned to (for access filtering in the directory).
export const getUserClientAssignments = async (uid: string): Promise<ClientAssignment[]> => {
  if (!isFirebaseInitialized || !uid) return [];
  try {
    const snap = await getDocs(query(collection(db, 'client_assignments'), where('uid', '==', uid)));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as ClientAssignment);
  } catch (e) { console.error('Failed to load my assignments', e); return []; }
};

export const getAgencyMembers = async (agencyId: string): Promise<WorkspaceMember[]> => {
  if (!isFirebaseInitialized || !agencyId) return [];
  try {
    const snap = await getDocs(query(collection(db, 'agency_members'), where('container_id', '==', agencyId)));
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }) as WorkspaceMember)
      .filter(m => m.status !== 'removed')
      .sort((a, b) => (a.email || '').localeCompare(b.email || ''));
  } catch (e) { console.error('Failed to load agency members', e); return []; }
};

// --- Client notes ---
export const getClientNotes = async (clientId: string, agencyId?: string): Promise<ClientNote[]> => {
  if (!isFirebaseInitialized || !clientId) return [];
  try {
    const base = collection(db, 'client_notes');
    const q = agencyId
      ? query(base, where('agency_id', '==', agencyId), where('client_id', '==', clientId))
      : query(base, where('client_id', '==', clientId));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }) as ClientNote)
      .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
  } catch (e) { console.error('Failed to load notes', e); return []; }
};

export const createClientNote = async (
  n: { client_id: string; agency_id: string; author_uid: string; author_name?: string; content: string; tags?: string[] }
): Promise<ClientNote | null> => {
  if (!isFirebaseInitialized) return null;
  try {
    const data = { ...n, pinned: false, created_at: new Date().toISOString() };
    const ref = await addDoc(collection(db, 'client_notes'), data);
    return { id: ref.id, ...data } as ClientNote;
  } catch (e) { console.error('Failed to add note', e); return null; }
};

export const updateClientNote = async (id: string, patch: Partial<Pick<ClientNote, 'content' | 'pinned' | 'tags'>>): Promise<void> => {
  if (!isFirebaseInitialized) return;
  try { await updateDoc(doc(db, 'client_notes', id), { ...patch, updated_at: new Date().toISOString() }); }
  catch (e) { console.error('Failed to update note', e); }
};

export const deleteClientNote = async (id: string): Promise<void> => {
  if (!isFirebaseInitialized) return;
  try { await deleteDoc(doc(db, 'client_notes', id)); } catch (e) { console.error('Failed to delete note', e); }
};

// --- Client activity ---
export const getClientActivity = async (clientId: string, agencyId?: string, max = 50): Promise<ClientActivity[]> => {
  if (!isFirebaseInitialized || !clientId) return [];
  try {
    const base = collection(db, 'client_activity');
    const q = agencyId
      ? query(base, where('agency_id', '==', agencyId), where('client_id', '==', clientId))
      : query(base, where('client_id', '==', clientId));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }) as ClientActivity)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, max);
  } catch (e) { console.error('Failed to load client activity', e); return []; }
};

export const logClientActivity = async (
  clientId: string, agencyId: string, type: string, actorUid: string, actorName: string, summary: string
): Promise<void> => {
  if (!isFirebaseInitialized || !clientId) return;
  try {
    await addDoc(collection(db, 'client_activity'), {
      client_id: clientId, agency_id: agencyId, type, actor_uid: actorUid, actor_name: actorName,
      summary, created_at: new Date().toISOString(),
    });
  } catch (e) { console.error('Failed to log client activity', e); }
};

export const getAgencyInvitations = async (email: string): Promise<AgencyInvitation[]> => {
  if (!isFirebaseInitialized || !email) return [];
  try {
    const snap = await getDocs(query(
      collection(db, 'agency_invitations'),
      where('email', '==', email.toLowerCase()),
      where('status', '==', 'pending'),
    ));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as AgencyInvitation);
  } catch (e) { console.error('Failed to load agency invitations', e); return []; }
};

// --- Privileged mutations via Cloud Functions ---
export const callManageAgency = async (action: 'create' | 'update' | 'archive' | 'transfer', payload: any) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  const fn = httpsCallable(functions, 'manageAgency');
  try { return (await fn({ action, payload })).data as any; }
  catch (error: any) { throw new Error(error.message || 'Agency action failed.'); }
};

export const callManageClient = async (
  action: 'create' | 'update' | 'archive' | 'assign' | 'unassign' | 'tag',
  payload: any
) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  const fn = httpsCallable(functions, 'manageClient');
  try { return (await fn({ action, payload })).data as any; }
  catch (error: any) { throw new Error(error.message || 'Client action failed.'); }
};

export const callManageAgencyMember = async (
  action: 'invite' | 'accept' | 'updateRole' | 'remove' | 'revoke',
  payload: any
) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  const fn = httpsCallable(functions, 'manageAgencyMember');
  try { return (await fn({ action, payload })).data as any; }
  catch (error: any) { throw new Error(error.message || 'Agency membership action failed.'); }
};

// Direct member provisioning (active immediately) with per-member tools + token budget.
export const callCreateAgencyMember = async (params: {
  agencyId: string; email: string; password?: string; role: string; allowed_tools: string[]; token_budget: number;
}) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  const fn = httpsCallable(functions, 'createAgencyMember');
  try { return (await fn(params)).data as { success: boolean; uid: string; created: boolean }; }
  catch (error: any) { throw new Error(error.message || 'Create member failed.'); }
};

export const callUpdateAgencyMember = async (params: {
  agencyId: string; targetUid: string; role?: string; allowed_tools?: string[]; token_budget?: number;
}) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  const fn = httpsCallable(functions, 'updateAgencyMember');
  try { return (await fn(params)).data as { success: boolean }; }
  catch (error: any) { throw new Error(error.message || 'Update member failed.'); }
};

// ============================================================
// PHASE 6.3 — ENTERPRISE ANALYTICS SUITE DATA LAYER
// UI reads engine-produced aggregates (health/analytics/forecast/briefing); never raw data.
// ============================================================

export const getEnterprise = async (id: string): Promise<Enterprise | null> => {
  if (!isFirebaseInitialized || !id) return null;
  try { const s = await getDoc(doc(db, 'enterprises', id)); return s.exists() ? ({ id: s.id, ...(s.data() as any) } as Enterprise) : null; }
  catch (e) { console.error('Failed to load enterprise', e); return null; }
};

export const getEnterpriseMembers = async (enterpriseId: string): Promise<WorkspaceMember[]> => {
  if (!isFirebaseInitialized || !enterpriseId) return [];
  try {
    const snap = await getDocs(query(collection(db, 'enterprise_members'), where('container_id', '==', enterpriseId)));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as WorkspaceMember).filter(m => m.status !== 'removed');
  } catch (e) { console.error('Failed to load enterprise members', e); return []; }
};

export const getEnterpriseDepartments = async (enterpriseId: string): Promise<EnterpriseDepartment[]> => {
  if (!isFirebaseInitialized || !enterpriseId) return [];
  try { const s = await getDocs(query(collection(db, 'enterprise_departments'), where('enterprise_id', '==', enterpriseId))); return s.docs.map(d => ({ id: d.id, ...(d.data() as any) })); }
  catch (e) { console.error(e); return []; }
};

export const getEnterpriseBrands = async (enterpriseId: string): Promise<EnterpriseBrand[]> => {
  if (!isFirebaseInitialized || !enterpriseId) return [];
  try { const s = await getDocs(query(collection(db, 'enterprise_brands'), where('enterprise_id', '==', enterpriseId))); return s.docs.map(d => ({ id: d.id, ...(d.data() as any) })); }
  catch (e) { console.error(e); return []; }
};

// Latest engine outputs (sorted client-side, newest first).
const latestDoc = async <T,>(coll: string, enterpriseId: string): Promise<T | null> => {
  if (!isFirebaseInitialized) return null;
  try {
    const s = await getDocs(query(collection(db, coll), where('enterprise_id', '==', enterpriseId)));
    const rows = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
      .sort((a: any, b: any) => new Date(b.computed_at || b.created_at || 0).getTime() - new Date(a.computed_at || a.created_at || 0).getTime());
    return (rows[0] as T) || null;
  } catch (e) { console.error(`Failed to read ${coll}`, e); return null; }
};

export const getLatestHealthScore = (eid: string) => latestDoc<EnterpriseHealthScore>('enterprise_health_scores', eid);
export const getLatestAnalyticsSnapshot = (eid: string) => latestDoc<EnterpriseAnalyticsSnapshot>('enterprise_analytics', eid);

export const getEnterpriseForecasts = async (enterpriseId: string): Promise<EnterpriseForecast[]> => {
  if (!isFirebaseInitialized || !enterpriseId) return [];
  try { const s = await getDocs(query(collection(db, 'enterprise_forecasts'), where('enterprise_id', '==', enterpriseId))); return s.docs.map(d => ({ id: d.id, ...(d.data() as any) })); }
  catch (e) { console.error(e); return []; }
};

export const getEnterpriseBriefings = async (enterpriseId: string): Promise<EnterpriseBriefing[]> => {
  if (!isFirebaseInitialized || !enterpriseId) return [];
  try {
    const s = await getDocs(query(collection(db, 'enterprise_briefings'), where('enterprise_id', '==', enterpriseId)));
    return s.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as EnterpriseBriefing)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  } catch (e) { console.error(e); return []; }
};

export const getEnterpriseInvitations = async (email: string): Promise<EnterpriseInvitation[]> => {
  if (!isFirebaseInitialized || !email) return [];
  try {
    const s = await getDocs(query(collection(db, 'enterprise_invitations'), where('email', '==', email.toLowerCase()), where('status', '==', 'pending')));
    return s.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as EnterpriseInvitation);
  } catch (e) { console.error(e); return []; }
};

// --- Privileged mutations + engine triggers via Cloud Functions ---
export const callManageEnterprise = async (action: 'create' | 'update' | 'archive' | 'transfer' | 'link', payload: any) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  try { return (await httpsCallable(functions, 'manageEnterprise')({ action, payload })).data as any; }
  catch (error: any) { throw new Error(error.message || 'Enterprise action failed.'); }
};
export const callManageDepartment = async (action: 'create' | 'update' | 'delete', payload: any) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  try { return (await httpsCallable(functions, 'manageDepartment')({ action, payload })).data as any; }
  catch (error: any) { throw new Error(error.message || 'Department action failed.'); }
};
export const callManageBrand = async (action: 'create' | 'update' | 'delete', payload: any) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  try { return (await httpsCallable(functions, 'manageBrand')({ action, payload })).data as any; }
  catch (error: any) { throw new Error(error.message || 'Brand action failed.'); }
};
export const callManageEnterpriseMember = async (action: 'invite' | 'accept' | 'updateRole' | 'remove' | 'revoke', payload: any) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  try { return (await httpsCallable(functions, 'manageEnterpriseMember')({ action, payload })).data as any; }
  catch (error: any) { throw new Error(error.message || 'Enterprise membership action failed.'); }
};
// Engine: recompute aggregates/health (server-side, Admin SDK). Deploy-time.
export const callRunEnterpriseAggregation = async (enterpriseId: string) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  try { return (await httpsCallable(functions, 'runEnterpriseAggregation')({ enterpriseId })).data as any; }
  catch (error: any) { throw new Error(error.message || 'Aggregation failed.'); }
};
// AI Executive Insights: generate a briefing for a period (server-side Gemini). Deploy-time.
export const callGenerateExecutiveBriefing = async (enterpriseId: string, period: BriefingPeriod) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  try { return (await httpsCallable(functions, 'generateExecutiveBriefing')({ enterpriseId, period })).data as any; }
  catch (error: any) { throw new Error(error.message || 'Briefing generation failed.'); }
};

// --- NOTIFICATIONS (§39) ---
// In-app notification center. Emits are best-effort and never block the main flow.
// EMAIL SEAM (§67): every user-facing notification flows through here. To add the email
// channel without touching call sites, deploy a Firestore `onCreate` Cloud Function trigger
// on the `notifications` collection that fans each new doc out to an email provider
// (e.g. SendGrid/Resend) using the user's email + category→template mapping. Respect a
// per-user `email_opt_out`/quiet-hours flag before sending. See docs/OPERATIONS.md.
export const createNotification = async (
  userId: string,
  category: NotificationCategory,
  title: string,
  body?: string
): Promise<void> => {
  if (!isFirebaseInitialized || !userId) return;
  try {
    await addDoc(collection(db, 'notifications'), {
      uid: userId,
      category,
      title,
      body: body || '',
      read: false,
      created_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('Failed to create notification', e);
  }
};

export const getUserNotifications = async (userId: string): Promise<AppNotification[]> => {
  if (!isFirebaseInitialized) return [];
  try {
    const q = query(collection(db, 'notifications'), where('uid', '==', userId));
    const snapshot = await getDocs(q);
    const rows = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as AppNotification[];
    return rows.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  } catch (e) {
    console.error('Failed to fetch notifications', e);
    return [];
  }
};

export const markNotificationRead = async (id: string): Promise<void> => {
  if (!isFirebaseInitialized) return;
  try { await updateDoc(doc(db, 'notifications', id), { read: true }); } catch (e) { console.error(e); }
};

export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  if (!isFirebaseInitialized) return;
  try {
    const q = query(collection(db, 'notifications'), where('uid', '==', userId), where('read', '==', false));
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map(d => updateDoc(doc(db, 'notifications', d.id), { read: true })));
  } catch (e) {
    console.error('Failed to mark all read', e);
  }
};

// --- ADMIN FUNCTIONS ---

export interface PlatformStats {
  totalUsers: number;
  activeUsers: number;
  totalAnalyses: number;
  failedAnalyses: number;
  tokensConsumed: number;
}

export const adminGetPlatformStats = async (): Promise<PlatformStats> => {
  if (!isFirebaseInitialized) return { totalUsers: 0, activeUsers: 0, totalAnalyses: 0, failedAnalyses: 0, tokensConsumed: 0 };
  
  const usersColl = collection(db, 'users');
  const logsColl = collection(db, 'action_logs');
  
  // Calculate 24h window
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Total Users Count
    const usersSnap = await getCountFromServer(usersColl);
    const totalUsers = usersSnap.data().count;

    // 2. Active Users (Last 24h)
    const activeUsersQuery = query(usersColl, where('last_active', '>=', twentyFourHoursAgo));
    const activeUsersSnap = await getCountFromServer(activeUsersQuery);
    const activeUsers = activeUsersSnap.data().count;

    // 3. Tokens Consumed (Sum)
    const logsAggSnap = await getAggregateFromServer(logsColl, {
      totalTokens: sum('tokens_used')
    });
    const tokensConsumed = logsAggSnap.data().totalTokens;

    // 4. Total Analyses Count
    const totalAnalysesSnap = await getCountFromServer(logsColl);
    const totalAnalyses = totalAnalysesSnap.data().count;

    // 5. Failed Analyses Count
    const failedQuery = query(logsColl, where('status', '==', 'failed_refunded'));
    const failedSnap = await getCountFromServer(failedQuery);
    const failedAnalyses = failedSnap.data().count;

    return {
      totalUsers,
      activeUsers,
      totalAnalyses,
      failedAnalyses,
      tokensConsumed
    };
  } catch (e) {
    console.error("Failed to fetch platform stats", e);
    // Return safe zero values on error
    return { totalUsers: 0, activeUsers: 0, totalAnalyses: 0, failedAnalyses: 0, tokensConsumed: 0 };
  }
};

export const adminGetAllUsers = async (): Promise<UserProfile[]> => {
  if (!isFirebaseInitialized) return [];
  try {
  const q = query(collection(db, 'users'), orderBy('last_active', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      email: data.email,
      tokens: data.tokens,
      tier: data.tier,
      role: data.email === 'admin@marketbrainos.com' ? 'super_admin' : (data.role || 'user'),
      last_active: data.last_active,
      is_suspended: data.is_suspended,
      risk_score: data.risk_score,
      // Extra fields for the admin directory + growth charts (all optional).
      created_at: (data as any).created_at,
      subscription_status: data.subscription_status || (data.tier === 'pro' ? 'active' : 'free'),
      first_name: data.first_name,
      last_name: data.last_name,
      company_name: data.company_name,
    } as UserProfile & { created_at?: string };
  });
  } catch (e) { console.error('Failed to fetch users', e); return []; }
};

// All payments across the platform (admin-only; rules allow isPlatformAdmin to list). Powers the
// Revenue + Token-purchase metrics. Sorted newest-first client-side.
export const adminGetAllPayments = async (): Promise<PaymentRecord[]> => {
  if (!isFirebaseInitialized) return [];
  try {
    const snap = await getDocs(collection(db, 'payments'));
    const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as PaymentRecord);
    return rows.sort((a, b) => {
      const ta = a.created_at ? (a.created_at.toMillis ? a.created_at.toMillis() : new Date(a.created_at).getTime()) : 0;
      const tb = b.created_at ? (b.created_at.toMillis ? b.created_at.toMillis() : new Date(b.created_at).getTime()) : 0;
      return tb - ta;
    });
  } catch (e) { console.error('Failed to fetch payments', e); return []; }
};

// Admin read-only listings of org containers (rules allow isPlatformAdmin to list).
export const adminGetWorkspaces = async (): Promise<Workspace[]> => {
  if (!isFirebaseInitialized) return [];
  try {
    const snap = await getDocs(collection(db, 'workspaces'));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as Workspace);
  } catch (e) { console.error('Failed to fetch workspaces', e); return []; }
};
export const adminGetAgencies = async (): Promise<Agency[]> => {
  if (!isFirebaseInitialized) return [];
  try {
    const snap = await getDocs(collection(db, 'agencies'));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as Agency);
  } catch (e) { console.error('Failed to fetch agencies', e); return []; }
};
export const adminGetEnterprises = async (): Promise<Enterprise[]> => {
  if (!isFirebaseInitialized) return [];
  try {
    const snap = await getDocs(collection(db, 'enterprises'));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as Enterprise);
  } catch (e) { console.error('Failed to fetch enterprises', e); return []; }
};

// All reports platform-wide (admin Report Management). Requires the firestore.rules admin-read
// addition (|| isPlatformAdmin() on reports read) to return data; otherwise returns [].
export const adminGetAllReports = async (): Promise<Report[]> => {
  if (!isFirebaseInitialized) return [];
  try {
    const snap = await getDocs(collection(db, 'reports'));
    const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as Report);
    return rows.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  } catch (e) { console.error('Failed to fetch reports', e); return []; }
};

export const adminGetAuditLogs = async (): Promise<AuditLogEntry[]> => {
  if (!isFirebaseInitialized) return [];
  const q = query(collection(db, 'admin_audit_logs'), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogEntry));
};

export const adminGetSecurityLogs = async (): Promise<SecurityEvent[]> => {
  if (!isFirebaseInitialized) return [];
  const q = query(collection(db, 'security_audit_logs'), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SecurityEvent));
};

export const adminGetActionLogs = async (limitCount: number = 100): Promise<ActionLogEntry[]> => {
  if (!isFirebaseInitialized) return [];
  
  try {
    // We have a mixed schema in 'action_logs'.
    // 1. Client logs have 'timestamp' string (ISO).
    // 2. Server logs have 'created_at' Timestamp.
    // To show a comprehensive view, we fetch both recent slices and merge.
    
    const serverQ = query(collection(db, 'action_logs'), orderBy('created_at', 'desc'), limit(limitCount));
    const clientQ = query(collection(db, 'action_logs'), orderBy('timestamp', 'desc'), limit(limitCount));
    
    const [serverSnap, clientSnap] = await Promise.all([getDocs(serverQ), getDocs(clientQ)]);
    
    const logs: ActionLogEntry[] = [];
    
    serverSnap.forEach(d => logs.push({ id: d.id, ...d.data() } as ActionLogEntry));
    clientSnap.forEach(d => {
      // Avoid duplicates if any doc has both (unlikely given current implementation but safe)
      if (!logs.find(l => l.id === d.id)) {
        logs.push({ id: d.id, ...d.data() } as ActionLogEntry);
      }
    });

    // Normalize sorting client-side
    return logs.sort((a, b) => {
      const tA = a.created_at ? a.created_at.toMillis() : new Date(a.timestamp || 0).getTime();
      const tB = b.created_at ? b.created_at.toMillis() : new Date(b.timestamp || 0).getTime();
      return tB - tA;
    });

  } catch (e) {
    console.error("Failed to fetch action logs", e);
    return [];
  }
};

// --- SYSTEM MONITORING (§68) ---
// Aggregates the most-recent action_logs into operational health metrics for the
// admin dashboard. Pure client-side roll-up over the existing log stream — no new backend.

export interface SystemMetrics {
  sampleSize: number;
  statusCounts: { success: number; failed: number; blocked: number; other: number };
  byModule: { module: string; count: number }[];
  topErrors: { code: string; count: number }[];
  recentIssues: ActionLogEntry[];
}

/** Pure aggregation over an already-fetched log slice (no I/O) — reusable by the dashboard. */
export const computeSystemMetrics = (logs: ActionLogEntry[]): SystemMetrics => {
  const empty: SystemMetrics = {
    sampleSize: 0,
    statusCounts: { success: 0, failed: 0, blocked: 0, other: 0 },
    byModule: [],
    topErrors: [],
    recentIssues: [],
  };
  if (!logs || logs.length === 0) return empty;

  const statusCounts = { success: 0, failed: 0, blocked: 0, other: 0 };
  const moduleMap = new Map<string, number>();
  const errorMap = new Map<string, number>();

  logs.forEach(l => {
    if (l.status === 'success') statusCounts.success++;
    else if (l.status === 'failed_refunded') statusCounts.failed++;
    else if (l.status === 'blocked') statusCounts.blocked++;
    else statusCounts.other++;

    const mod = l.module || l.action || 'unknown';
    moduleMap.set(mod, (moduleMap.get(mod) || 0) + 1);

    if ((l.status === 'failed_refunded' || l.status === 'blocked') && l.error_code) {
      errorMap.set(l.error_code, (errorMap.get(l.error_code) || 0) + 1);
    }
  });

  const byModule = Array.from(moduleMap.entries())
    .map(([module, count]) => ({ module, count }))
    .sort((a, b) => b.count - a.count);
  const topErrors = Array.from(errorMap.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const recentIssues = logs
    .filter(l => l.status === 'failed_refunded' || l.status === 'blocked')
    .slice(0, 15);

  return { sampleSize: logs.length, statusCounts, byModule, topErrors, recentIssues };
};

/** Fetch the most-recent action_logs and roll them up into operational metrics. */
export const getSystemMetrics = async (limitN: number = 200): Promise<SystemMetrics> => {
  if (!isFirebaseInitialized) return computeSystemMetrics([]);
  const logs = await adminGetActionLogs(limitN);
  return computeSystemMetrics(logs);
};

export const getUserActionLogs = async (userId: string, limitCount: number = 50): Promise<ActionLogEntry[]> => {
  if (!isFirebaseInitialized) return [];
  try {
    // We prioritize server-side logs which use 'uid' and 'created_at' (Firestore Timestamp)
    // Client logs use 'user_id' and 'timestamp' string.
    // For Token Usage history, server logs are the source of truth.
    
    const q = query(
      collection(db, 'action_logs'), 
      where('uid', '==', userId), 
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ActionLogEntry));
    
    // Sort client-side to avoid compound index requirements in this restricted environment
    return logs.sort((a, b) => {
      const tA = a.created_at ? a.created_at.toMillis() : 0;
      const tB = b.created_at ? b.created_at.toMillis() : 0;
      return tB - tA;
    });
  } catch (e) {
    console.error("Failed to fetch user history", e);
    return [];
  }
};

export const getUserPaymentHistory = async (userId: string): Promise<PaymentRecord[]> => {
  if (!isFirebaseInitialized) return [];
  try {
    const q = query(
      collection(db, 'payments'),
      where('uid', '==', userId)
    );
    const snapshot = await getDocs(q);
    const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PaymentRecord));
    
    // Sort client-side
    return records.sort((a, b) => {
      const tA = a.created_at ? a.created_at.toMillis() : 0;
      const tB = b.created_at ? b.created_at.toMillis() : 0;
      return tB - tA;
    });
  } catch (e) {
    console.error("Failed to fetch payments", e);
    return [];
  }
};

// --- SECURE ADMIN MUTATIONS (VIA CLOUD FUNCTION) ---

export type AdminUserAction = 
  | 'promoteToAdmin' 
  | 'demoteAdmin' 
  | 'changePlan' 
  | 'resetTokens' 
  | 'toggleStatus';

export const callAdminUserAction = async (action: AdminUserAction, targetUserId: string, payload?: any) => {
  if (!isFirebaseInitialized) throw new Error("Connection failed");
  const manageUser = httpsCallable(functions, 'manageUser');
  try {
    const result = await manageUser({ action, targetUserId, payload });
    return result.data;
  } catch (error: any) {
    throw new Error(error.message || "Admin action failed on server.");
  }
};

// --- New admin mutations (require `firebase deploy --only functions` to be live) ---
export type AdminTokenAction = 'add' | 'remove' | 'refund' | 'bonus' | 'reset';
export const callAdminManageTokens = async (action: AdminTokenAction, targetUserId: string, payload: { amount?: number; reason?: string }) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  const fn = httpsCallable(functions, 'adminManageTokens');
  try { return (await fn({ action, targetUserId, payload })).data as { success: boolean; newBalance?: number }; }
  catch (e: any) { throw new Error(e.message || 'Token adjustment failed.'); }
};

export type AdminSubAction = 'grant' | 'trial' | 'extend' | 'cancel' | 'changePlan';
export const callAdminManageSubscription = async (action: AdminSubAction, targetUserId: string, payload: { plan?: string; days?: number }) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  const fn = httpsCallable(functions, 'adminManageSubscription');
  try { return (await fn({ action, targetUserId, payload })).data; }
  catch (e: any) { throw new Error(e.message || 'Subscription action failed.'); }
};

export const callAdminBulkAction = async (action: string, targetUserIds: string[], payload?: any) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  const fn = httpsCallable(functions, 'adminBulkAction');
  try { return (await fn({ action, targetUserIds, payload })).data as { success: boolean; count: number }; }
  catch (e: any) { throw new Error(e.message || 'Bulk action failed.'); }
};

export const callAdminCreateUser = async (email: string, password: string, tier?: string) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  const fn = httpsCallable(functions, 'adminCreateUser');
  try { return (await fn({ email, password, tier })).data as { success: boolean; uid: string }; }
  catch (e: any) { throw new Error(e.message || 'User creation failed.'); }
};

export type AdminOrgKind = 'workspace' | 'agency' | 'enterprise';
export type AdminOrgAction = 'suspend' | 'restore' | 'archive' | 'transfer';
export const callAdminManageOrg = async (kind: AdminOrgKind, orgId: string, action: AdminOrgAction, payload?: any) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  const fn = httpsCallable(functions, 'adminManageOrg');
  try { return (await fn({ kind, orgId, action, payload })).data; }
  catch (e: any) { throw new Error(e.message || 'Organization action failed.'); }
};

export const callAdminRefund = async (payload: { paymentId?: string; uid?: string; amount?: number; reason?: string }) => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  const fn = httpsCallable(functions, 'adminRefund');
  try { return (await fn(payload)).data; }
  catch (e: any) { throw new Error(e.message || 'Refund failed.'); }
};

export const callAdminManageReport = async (reportId: string, action: 'archive' | 'delete' | 'restore') => {
  if (!isFirebaseInitialized) throw new Error('Connection failed');
  const fn = httpsCallable(functions, 'adminManageReport');
  try { return (await fn({ reportId, action })).data; }
  catch (e: any) { throw new Error(e.message || 'Report action failed.'); }
};

export const updateUserRiskProfile = async (userId: string, riskScore: number, isSuspended: boolean, reason?: string) => {
  if (!isFirebaseInitialized) return;
  try {
    const updateData: any = { risk_score: riskScore, is_suspended: isSuspended };
    if (reason) updateData.suspension_reason = reason;
    await updateDoc(doc(db, 'users', userId), updateData);
  } catch (e) {
    console.error("Failed to update risk profile", e);
  }
};