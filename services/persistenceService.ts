
import { supabase } from './supabaseClient';
import { 
  AngleMinerResults, 
  TestLabResults, 
  AuditResult, 
  UserProfile, 
  UserTier, 
  UserRole, 
  AuditLogEntry, 
  SecurityEvent,
  ActionLogEntry,
  SystemSettings
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

const getLastHash = async (table: string): Promise<string> => {
  try {
    const { data, error } = await supabase.from(table).select('hash').order('timestamp', { ascending: false }).limit(1).single();
    return (error || !data) ? GENESIS_HASH : data.hash;
  } catch { return GENESIS_HASH; }
};

export const getSystemSettings = async (): Promise<SystemSettings> => {
  const { data } = await supabase.from('system_settings').select('*').limit(1).single();
  return data || { emergency_lockdown: false, last_updated: new Date().toISOString(), updated_by: 'system' };
};

export const updateSystemEmergency = async (admin: UserProfile, active: boolean) => {
  const now = new Date().toISOString();
  await supabase.from('system_settings').update({ 
    emergency_lockdown: active, 
    last_updated: now, 
    updated_by: admin.email 
  }).eq('id', 1); 
  
  await SecurityEngine.handleViolation(
    active ? 'SYSTEM_EMERGENCY_ACTIVATED' : 'SYSTEM_EMERGENCY_DEACTIVATED',
    'critical',
    `System emergency state toggled to ${active ? 'ACTIVE' : 'INACTIVE'} by admin.`,
    admin
  );
  await logAdminAction(admin, active ? 'LOCKDOWN_ACTIVATED' : 'LOCKDOWN_RELEASED', 'GLOBAL_SYSTEM');
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (error || !data) return null;
    return {
      ...data,
      role: data.email === 'admin@marketbrainos.com' ? 'super_admin' : (data.email === 'ops@marketbrainos.com' ? 'ops_admin' : 'user'),
      session_started: data.session_started || new Date().toISOString()
    };
  } catch { return null; }
};

export const logUserAction = async (entry: Omit<ActionLogEntry, 'id' | 'timestamp' | 'hash' | 'previous_hash'>) => {
  const prevHash = await getLastHash('action_logs');
  const timestamp = new Date().toISOString();
  const content = JSON.stringify({ ...entry, timestamp });
  const hash = await generateHash(content, prevHash);
  await supabase.from('action_logs').insert({ ...entry, timestamp, previous_hash: prevHash, hash });
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
  const prevHash = await getLastHash('security_audit_logs');
  const timestamp = new Date().toISOString();
  const content = JSON.stringify({ ...event, timestamp });
  const hash = await generateHash(content, prevHash);
  await supabase.from('security_audit_logs').insert({ ...event, timestamp, previous_hash: prevHash, hash });
};

export const logAdminAction = async (admin: UserProfile, action: string, target: string, metadata?: any) => {
  const prevHash = await getLastHash('admin_audit_logs');
  const timestamp = new Date().toISOString();
  const entry = { admin_email: admin.email, admin_role: admin.role, action_type: action, target, metadata };
  const content = JSON.stringify({ ...entry, timestamp });
  const hash = await generateHash(content, prevHash);
  await supabase.from('admin_audit_logs').insert({ ...entry, timestamp, previous_hash: prevHash, hash });
};

// --- TOKEN MANAGEMENT & COMPENSATIONS ---

export const deductTokens = async (userId: string, cost: number): Promise<number> => {
  const { data: current } = await supabase.from('users').select('tokens').eq('id', userId).single();
  const newTokens = Math.max(0, (current?.tokens ?? 0) - cost);
  const { error } = await supabase.from('users').update({ tokens: newTokens, last_active: new Date().toISOString() }).eq('id', userId);
  if (error) throw new Error("Token deduction failed.");
  return newTokens;
};

export const refundTokens = async (userId: string, amount: number): Promise<void> => {
  const { data: current } = await supabase.from('users').select('tokens').eq('id', userId).single();
  const newTokens = (current?.tokens ?? 0) + amount;
  await supabase.from('users').update({ tokens: newTokens }).eq('id', userId);
};

// --- ARTIFACT PERSISTENCE (WITH RETURNS FOR ROLLBACK) ---

export const saveAngleMinerResult = async (userId: string, product: string, industry: string, target: string, results: AngleMinerResults) => {
  await logUserAction({ user_id: userId, module: 'AngleMiner X', action: 'GENERATE_ANGLES' });
  const { data, error } = await supabase.from('angleminer_results')
    .insert({ user_id: userId, industry, target_audience: target, angles_output: results })
    .select().single();
  if (error) throw new Error(`Persistence Error: ${error.message}`);
  return data;
};

export const deleteAngleMinerResult = async (id: string) => {
  await supabase.from('angleminer_results').delete().eq('id', id);
};

export const saveTestLabResult = async (userId: string, type: string, variants: string[], results: TestLabResults) => {
  await logUserAction({ user_id: userId, module: 'TestLab Pro', action: 'RUN_SIMULATION' });
  const { data, error } = await supabase.from('testlab_results')
    .insert({ user_id: userId, comparison_type: type, winner: results.winnerLabel })
    .select().single();
  if (error) throw new Error(`Persistence Error: ${error.message}`);
  return data;
};

export const deleteTestLabResult = async (id: string) => {
  await supabase.from('testlab_results').delete().eq('id', id);
};

export const saveConversionDoctorResult = async (userId: string, input: string, score: number, result: AuditResult) => {
  await logUserAction({ user_id: userId, module: 'Conversion Doctor', action: 'RUN_AUDIT' });
  const { data, error } = await supabase.from('conversion_doctor_results')
    .insert({ user_id: userId, conversion_score: score, audit_output: result })
    .select().single();
  if (error) throw new Error(`Persistence Error: ${error.message}`);
  return data;
};

export const deleteConversionDoctorResult = async (id: string) => {
  await supabase.from('conversion_doctor_results').delete().eq('id', id);
};

export const saveWorkflowRun = async (userId: string, angle: string, testScore: number, conversionScore: number, finalOutput: any) => {
  await logUserAction({ user_id: userId, module: 'Workflow', action: 'EXECUTE_PIPELINE' });
  const { data, error } = await supabase.from('workflow_runs')
    .insert({ user_id: userId, selected_angle: angle, final_output: finalOutput })
    .select().single();
  if (error) throw new Error(`Persistence Error: ${error.message}`);
  return data;
};

export const deleteWorkflowRun = async (id: string) => {
  await supabase.from('workflow_runs').delete().eq('id', id);
};

// --- ADMIN FUNCTIONS ---

export const adminGetAllUsers = async (): Promise<UserProfile[]> => {
  const { data } = await supabase.from('users').select('*').order('last_active', { ascending: false });
  return (data || []).map((u: any) => ({
    ...u,
    role: u.email === 'admin@marketbrainos.com' ? 'super_admin' : (u.email === 'ops@marketbrainos.com' ? 'ops_admin' : 'user')
  }));
};

export const adminGetAuditLogs = async (): Promise<AuditLogEntry[]> => {
  const { data } = await supabase.from('admin_audit_logs').select('*').order('timestamp', { ascending: false });
  return data || [];
};

export const adminGetSecurityLogs = async (): Promise<SecurityEvent[]> => {
  const { data } = await supabase.from('security_audit_logs').select('*').order('timestamp', { ascending: false });
  return data || [];
};

export const adminSuspendUser = async (admin: UserProfile, userId: string, reason: string) => {
  const check = await SecurityEngine.checkPermission(admin, 'admin:user_management');
  if (!check.allowed) throw new Error(check.error || "Permission Denied.");
  
  await supabase.from('users').update({ is_suspended: true, suspension_reason: reason }).eq('id', userId);
  await logAdminAction(admin, 'USER_SUSPENDED', userId, { reason });
};

export const adminUpdateUserTokens = async (admin: UserProfile, userId: string, tokens: number) => {
  const check = await SecurityEngine.checkPermission(admin, 'admin:token_management');
  if (!check.allowed) throw new Error(check.error || "Permission Denied.");

  await supabase.from('users').update({ tokens }).eq('id', userId);
  await logAdminAction(admin, 'TOKENS_MODIFIED', userId, { new_tokens: tokens });
};

export const updateUserRiskProfile = async (userId: string, riskScore: number, isSuspended: boolean, reason?: string) => {
  await supabase.from('users').update({ risk_score: riskScore, is_suspended: isSuspended, suspension_reason: reason }).eq('id', userId);
};
