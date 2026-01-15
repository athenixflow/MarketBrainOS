
import { db, isFirebaseInitialized } from './firebase';
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
  deleteDoc
} from 'firebase/firestore';
import { 
  AngleMinerResults, 
  TestLabResults, 
  AuditResult, 
  UserProfile, 
  SystemSettings,
  AuditLogEntry, 
  SecurityEvent,
  ActionLogEntry
} from '../types';
import { SecurityEngine } from './securityEngine';

export const TOKEN_COSTS = {
  ANGLEMINER_GENERATE: 10,
  ANGLEMINER_IMPROVE: 3,
  TESTLAB_RUN: 6,
  TESTLAB_IMPROVE: 3,
  CONVERSION_AUDIT: 12,
  CONVERSION_REWRITE: 4,
  WORKFLOW_RUN: 20,
};

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
  } catch (e) {
    console.error("Failed to load settings", e);
  }
  return { emergency_lockdown: false, last_updated: new Date().toISOString(), updated_by: 'system' };
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
  const content = JSON.stringify({ ...entry, timestamp });
  const hash = await generateHash(content, prevHash);
  
  await addDoc(collection(db, 'action_logs'), { ...entry, timestamp, previous_hash: prevHash, hash });
};

export const logExecutionTrace = async (trace: any) => {
  await logUserAction({
    user_id: trace.userId,
    module: 'System_Core', 
    action: `EXECUTION_TRACE:${trace.operation.toUpperCase()}`,
    metadata: {
      trace_id: trace.id,
      status: trace.status,
      duration_ms: Date.now() - trace.timestamp,
      steps_count: trace.steps.length,
      full_trace: trace 
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

// --- TOKEN MANAGEMENT ---

export const deductTokens = async (userId: string, cost: number): Promise<number> => {
  if (!isFirebaseInitialized) return 0;
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error("User not found.");
  
  const currentTokens = docSnap.data().tokens || 0;
  const newTokens = Math.max(0, currentTokens - cost);
  
  await updateDoc(docRef, { 
    tokens: newTokens, 
    last_active: new Date().toISOString() 
  });
  
  return newTokens;
};

export const refundTokens = async (userId: string, amount: number): Promise<void> => {
  if (!isFirebaseInitialized) return;
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return;
  
  const currentTokens = docSnap.data().tokens || 0;
  await updateDoc(docRef, { tokens: currentTokens + amount });
};

// --- ARTIFACT PERSISTENCE ---

export const saveAngleMinerResult = async (userId: string, product: string, industry: string, target: string, results: AngleMinerResults) => {
  if (!isFirebaseInitialized) return { id: 'mock_id', ...results };
  await logUserAction({ user_id: userId, module: 'AngleMiner X', action: 'GENERATE_ANGLES' });
  
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
  await logUserAction({ user_id: userId, module: 'TestLab Pro', action: 'RUN_SIMULATION' });
  
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
  await logUserAction({ user_id: userId, module: 'Conversion Doctor', action: 'RUN_AUDIT' });
  
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
  await logUserAction({ user_id: userId, module: 'Workflow', action: 'EXECUTE_PIPELINE' });
  
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

export const adminSuspendUser = async (admin: UserProfile, userId: string, reason: string) => {
  if (!isFirebaseInitialized) throw new Error("DB Error");
  const check = await SecurityEngine.checkPermission(admin, 'admin:user_management');
  if (!check.allowed) throw new Error(check.error || "Permission Denied.");
  
  await updateDoc(doc(db, 'users', userId), { 
    is_suspended: true, 
    suspension_reason: reason 
  });
  await logAdminAction(admin, 'USER_SUSPENDED', userId, { reason });
};

export const adminUpdateUserTokens = async (admin: UserProfile, userId: string, tokens: number) => {
  if (!isFirebaseInitialized) throw new Error("DB Error");
  const check = await SecurityEngine.checkPermission(admin, 'admin:token_management');
  if (!check.allowed) throw new Error(check.error || "Permission Denied.");

  await updateDoc(doc(db, 'users', userId), { tokens });
  await logAdminAction(admin, 'TOKENS_MODIFIED', userId, { new_tokens: tokens });
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
