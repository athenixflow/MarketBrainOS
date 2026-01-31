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
  PaymentRecord
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
      AngleMiner: true,
      ConversionDoctor: true,
      TestLabPro: true,
      Workflow: true
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
      last_verification: data.last_verification
    };
  } catch { return null; }
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