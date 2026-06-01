import { db, isFirebaseInitialized, functions } from './firebase';
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
  Report
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

export const callConfirmTopUp = async (paymentReference: string) => {
  if (!isFirebaseInitialized) throw new Error("Connection failed");
  const confirmTopUp = httpsCallable(functions, 'confirmTopUp');
  try {
    // Amount is hardcoded to 5 on client to match server expectation,
    // but server enforces it regardless.
    const result = await confirmTopUp({ paymentReference, amountPaid: 5 });
    return result.data;
  } catch (error: any) {
    throw new Error(error.message || "Top-up failed.");
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
      subscription_started_at: data.subscription_started_at
    };
  } catch { return null; }
};

export const setOnboarded = async (userId: string) => {
  if (!isFirebaseInitialized) return;
  try { await updateDoc(doc(db, 'users', userId), { onboarded: true }); } catch (e) { console.error(e); }
};

export const replayOnboarding = async (userId: string) => {
  if (!isFirebaseInitialized) return;
  try { await updateDoc(doc(db, 'users', userId), { onboarded: false }); } catch (e) { console.error(e); }
};

export const ensureUserProfile = async (userId: string, email: string) => {
  if (!isFirebaseInitialized) return;
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    await setDoc(docRef, {
      id: userId,
      email: email,
      tokens: 4,
      tier: 'free',
      role: email === 'admin@marketbrainos.com' ? 'super_admin' : 'user',
      onboarded: false,
      subscription_status: 'free',
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

export const logAdminAction = async (admin: UserProfile, action: string, target: string, metadata?: any) => {
  if (!isFirebaseInitialized) return;
  const prevHash = await safeGetLastHash('admin_audit_logs');
  const timestamp = new Date().toISOString();
  const entry = { admin_email: admin.email, admin_role: admin.role, action_type: action, target, metadata };
  const content = JSON.stringify({ ...entry, timestamp });
  const hash = await generateHash(content, prevHash);
  
  await addDoc(collection(db, 'admin_audit_logs'), { ...entry, timestamp, previous_hash: prevHash, hash });
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
    } else if (scope.level === 'client' && scope.clientId) {
      q = query(col, where('client_id', '==', scope.clientId), where('visibility_type', '==', 'client'));
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
    } else if (scope.level === 'client' && scope.clientId) {
      q = query(col, where('client_id', '==', scope.clientId), where('visibility_type', '==', 'client'));
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
      risk_score: data.risk_score
    } as UserProfile;
  });
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