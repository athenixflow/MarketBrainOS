
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, PageHeader, LoadingState, Tabs, ErrorMessage, PrimaryButton, Input, IntelligenceIndicator } from '../components/UI';
import { 
  adminGetAllUsers, 
  adminGetAuditLogs, 
  adminGetSecurityLogs, 
  adminGetActionLogs,
  callAdminUserAction,
  updateSystemEmergency, 
  getSystemSettings,
  getAdminSettings,
  callUpdateSystemSettings,
  adminGetPlatformStats,
  PlatformStats,
  AdminUserAction
} from '../services/persistenceService';
import { SecurityEngine } from '../services/securityEngine';
import { DiagnosisEngine } from '../services/diagnosisService';
import { UserProfile, AuditLogEntry, SecurityEvent, SystemLoadLevel, SystemSettings, DiagnosticResult, ActionLogEntry, AdminSettings } from '../types';

interface ConfirmationRequest {
  type: AdminUserAction | 'TOGGLE_LOCKDOWN' | 'UPDATE_SETTINGS';
  userId?: string;
  payload?: any;
  warningTitle: string;
  warningMessage: string;
  keyword: string;
}

const AdminDashboard: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('Overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityEvent[]>([]);
  const [actionLogs, setActionLogs] = useState<ActionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemLoad, setSystemLoad] = useState<{ level: SystemLoadLevel, score: number, percentage: number }>(SecurityEngine.getSystemLoadLevel());
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);

  // Health Metrics
  const [failureRate, setFailureRate] = useState(0);
  const [lastFailure, setLastFailure] = useState<string | null>(null);

  // Integrity Chain State
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [verifyingChain, setVerifyingChain] = useState(false);

  // Diagnostics State
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[]>([]);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);

  // Intervention UI State
  const [confirmationReq, setConfirmationReq] = useState<ConfirmationRequest | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  
  const [showStepUp, setShowStepUp] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingAction, setPendingAction] = useState<ConfirmationRequest | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Log Filters
  const [logFilterModule, setLogFilterModule] = useState('All');
  const [logFilterStatus, setLogFilterStatus] = useState('All');

  const load = async () => {
    setLoading(true);
    const [u, logs, sLogs, aLogs, settings, admSettings, stats] = await Promise.all([
      adminGetAllUsers(), 
      adminGetAuditLogs(),
      adminGetSecurityLogs(),
      adminGetActionLogs(200), // Fetch recent 200 actions
      getSystemSettings(),
      getAdminSettings(),
      adminGetPlatformStats()
    ]);
    setUsers(u);
    setAuditLogs(logs);
    setSecurityLogs(sLogs);
    setActionLogs(aLogs);
    setSystemSettings(settings);
    setAdminSettings(admSettings);
    setPlatformStats(stats);
    
    // Calculate Health Metrics from Action Logs (Real Data)
    const recentLogs = aLogs.filter(l => {
      const t = l.created_at ? l.created_at.toMillis() : new Date(l.timestamp || 0).getTime();
      return (Date.now() - t) < 24 * 60 * 60 * 1000; // Last 24h
    });
    
    const failures = recentLogs.filter(l => l.status === 'failed_refunded');
    const rate = recentLogs.length > 0 ? (failures.length / recentLogs.length) * 100 : 0;
    setFailureRate(rate);

    const lastFailLog = aLogs.find(l => l.status === 'failed_refunded');
    setLastFailure(lastFailLog ? (lastFailLog.created_at ? new Date(lastFailLog.created_at.toMillis()).toLocaleString() : new Date(lastFailLog.timestamp!).toLocaleString()) : null);

    setLoading(false);
    
    const verify = await SecurityEngine.verifyChainIntegrity(logs);
    setChainValid(verify.valid);
  };

  useEffect(() => {
    if (profile?.role !== 'user') load();
    const interval = setInterval(() => setSystemLoad(SecurityEngine.getSystemLoadLevel()), 5000);
    return () => clearInterval(interval);
  }, [profile]);

  const runManualIntegrityCheck = async () => {
    setVerifyingChain(true);
    const verify = await SecurityEngine.verifyChainIntegrity(auditLogs);
    setTimeout(() => {
      setChainValid(verify.valid);
      setVerifyingChain(false);
      if (!verify.valid) {
        alert("CRITICAL ERROR: Ledger Integrity Violation Detected at Block Chain.");
      }
    }, 1500);
  };

  const runDiagnostics = async () => {
    setRunningDiagnostics(true);
    const results = await DiagnosisEngine.runFullSuite();
    // Simulate slight delay for visual effect
    setTimeout(() => {
      setDiagnosticResults(results);
      setRunningDiagnostics(false);
    }, 800);
  };

  const allDiagnosticsPassed = diagnosticResults.length > 0 && diagnosticResults.every(r => r.status === 'PASS');

  // 1. Initial Request -> Opens Confirmation Modal
  const initiateAction = (type: ConfirmationRequest['type'], userId: string | undefined, payload?: any) => {
    let req: ConfirmationRequest;
    
    // Define warnings based on action type
    switch(type) {
      case 'promoteToAdmin':
        req = {
          type, userId, payload,
          warningTitle: "GRANT ADMINISTRATIVE PRIVILEGES",
          warningMessage: "This user will gain full access to user management and sensitive system controls.",
          keyword: "PROMOTE"
        };
        break;
      case 'demoteAdmin':
         req = {
          type, userId, payload,
          warningTitle: "REVOKE ADMINISTRATIVE PRIVILEGES",
          warningMessage: "This user will immediately lose access to all admin tools.",
          keyword: "DEMOTE"
        };
        break;
      case 'toggleStatus':
        req = {
          type, userId, payload,
          warningTitle: payload.targetStatus === 'disabled' ? "DISABLE ACCOUNT ACCESS" : "RESTORE ACCOUNT ACCESS",
          warningMessage: payload.targetStatus === 'disabled' 
            ? "User will be immediately signed out and blocked from logging in." 
            : "User will be allowed to sign in and use the platform again.",
          keyword: payload.targetStatus === 'disabled' ? "DISABLE" : "RESTORE"
        };
        break;
      case 'resetTokens':
        req = {
          type, userId, payload,
          warningTitle: "RESET TOKEN BALANCE",
          warningMessage: "User's token count will be reset to their plan's default immediately.",
          keyword: "RESET"
        };
        break;
      case 'changePlan':
         req = {
          type, userId, payload,
          warningTitle: "CHANGE SUBSCRIPTION TIER",
          warningMessage: `Switching user to ${payload.plan.toUpperCase()} plan.`,
          keyword: "CONFIRM"
        };
        break;
      case 'TOGGLE_LOCKDOWN':
        const active = payload.active;
        req = {
          type, userId, payload,
          warningTitle: active ? "ACTIVATE SYSTEM LOCKDOWN" : "RELEASE SYSTEM LOCKDOWN",
          warningMessage: active 
            ? "This will immediately halt all neural operations, suspend authentication, and block user access. This is a drastic emergency measure."
            : "This will restore full system functionality and allow user access.",
          keyword: active ? "LOCKDOWN" : "RELEASE"
        };
        break;
      case 'UPDATE_SETTINGS':
        const settingName = payload.name;
        const newVal = payload.value;
        req = {
          type, payload,
          warningTitle: `CHANGE SYSTEM SETTING: ${settingName}`,
          warningMessage: `You are about to change ${settingName} to ${newVal}. This will affect global platform behavior immediately.`,
          keyword: "CONFIRM"
        };
        break;
      default:
         req = { type, userId, payload, warningTitle: "CONFIRM ACTION", warningMessage: "Are you sure?", keyword: "YES" };
    }

    setConfirmationReq(req);
    setConfirmationInput('');
    setActionError(null);
  };

  // 2. Confirmed Intent -> Checks Permissions / Step-Up
  const handleConfirmedAction = async (req: ConfirmationRequest) => {
    setConfirmationReq(null); 
    if (!profile) return;
    setActionError(null);

    const scope = (req.type === 'TOGGLE_LOCKDOWN' || req.type === 'UPDATE_SETTINGS') ? 'admin:system_config' : 'admin:user_management';
    const check = await SecurityEngine.checkPermission(profile, scope);
    
    if (check.stepUpRequired) {
      setPendingAction(req);
      setShowStepUp(true);
      return;
    }

    if (!check.allowed) {
      setActionError(check.error || "Permission Denied.");
      return;
    }

    // Execute directly if no step-up needed
    executeAction(req);
  };

  // 3. Step-Up Verification -> Execute
  const handleVerifyStepUp = async () => {
    if (!profile || !pendingAction) return;
    const res = await SecurityEngine.verifyStepUp(profile, verificationCode);
    if (res.valid) {
      profile.is_verified_admin = true;
      profile.last_verification = new Date().toISOString();
      setShowStepUp(false);
      setVerificationCode('');
      executeAction(pendingAction);
    } else {
      setActionError("Invalid verification code.");
    }
  };

  // 4. Final Execution
  const executeAction = async (req: ConfirmationRequest) => {
    try {
      if (req.type === 'TOGGLE_LOCKDOWN') {
        await updateSystemEmergency(profile!, req.payload.active);
      } else if (req.type === 'UPDATE_SETTINGS') {
        await callUpdateSystemSettings(req.payload.changes);
      } else {
        // User Management Action
        if (req.userId) await callAdminUserAction(req.type as AdminUserAction, req.userId, req.payload);
      }
      // Refresh Data
      await load();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const getFilteredLogs = () => {
    return actionLogs.filter(log => {
      const modMatch = logFilterModule === 'All' || log.module === logFilterModule;
      const statusMatch = logFilterStatus === 'All' || 
                          (logFilterStatus === 'Failed' && log.status === 'failed_refunded') ||
                          (logFilterStatus === 'Blocked' && log.status === 'blocked') ||
                          (logFilterStatus === 'Success' && log.status === 'success') ||
                          (logFilterStatus === 'Client' && !log.status); 
      return modMatch && statusMatch;
    });
  };

  const ToggleSwitch: React.FC<{ label: string; checked: boolean; onChange: () => void; disabled?: boolean; color?: string }> = ({ label, checked, onChange, disabled, color = 'bg-[#FF0000]' }) => (
    <div className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border border-gray-100">
      <span className="text-sm font-bold text-[#0B0B0B]">{label}</span>
      <button 
        onClick={onChange}
        disabled={disabled}
        className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${checked ? color : 'bg-gray-300'} disabled:opacity-50`}
      >
        <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  );

  if (loading) return <LoadingState message="Synchronizing Strategic Ledger..." />;

  const clearanceLevel = profile?.is_verified_admin ? "Level 2: VERIFIED" : "Level 1: READ_ONLY";
  const isEmergencyActive = systemSettings?.emergency_lockdown;

  return (
    <div className="space-y-16 animate-in fade-in duration-700 pb-32 relative">
      
      {/* CONFIRMATION MODAL */}
      {confirmationReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0B0B]/95 backdrop-blur-md p-6">
          <div className="max-w-md w-full bg-[#1A1A1A] border-2 border-red-600 rounded-[32px] p-10 shadow-2xl shadow-red-900/40 animate-in zoom-in duration-300">
            <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] mb-4">Destructive Action Protocol</p>
            <h3 className="text-2xl font-black text-white mb-6 uppercase leading-none">{confirmationReq.warningTitle}</h3>
            <p className="text-sm font-medium text-gray-400 mb-8 leading-relaxed">
              {confirmationReq.warningMessage}
            </p>
            <div className="bg-black/50 p-6 rounded-2xl mb-8 border border-white/10">
               <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Type the following to confirm:</p>
               <p className="text-xl font-mono text-white tracking-widest font-bold select-all">"{confirmationReq.keyword}"</p>
            </div>
            <Input 
              label="Confirmation Keyword" 
              placeholder={confirmationReq.keyword}
              value={confirmationInput} 
              onChange={(e) => setConfirmationInput(e.target.value)} 
            />
            <div className="flex flex-col gap-4 mt-8">
              <button 
                onClick={() => handleConfirmedAction(confirmationReq)}
                disabled={confirmationInput !== confirmationReq.keyword}
                className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-[0.2em] rounded-xl hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Execute
              </button>
              <button onClick={() => setConfirmationReq(null)} className="w-full py-3 text-xs font-bold text-gray-500 hover:text-white uppercase tracking-widest">
                Cancel Operation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP UP MODAL */}
      {showStepUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0B0B]/90 backdrop-blur-sm p-6">
          <Card accent className="max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-xl font-black uppercase text-[#0B0B0B] mb-4">Identity Verification</h3>
            <p className="text-sm text-gray-500 mb-8 font-medium">Verify your administrative identity to proceed with destructive changes.</p>
            <Input 
              label="Verification Code" 
              placeholder="000000" 
              value={verificationCode} 
              onChange={(e) => setVerificationCode(e.target.value)} 
            />
            {actionError && <div className="mb-6"><ErrorMessage message={actionError} /></div>}
            <div className="flex gap-4">
              <PrimaryButton className="flex-grow" onClick={handleVerifyStepUp}>Authorize</PrimaryButton>
              <button onClick={() => setShowStepUp(false)} className="px-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Cancel</button>
            </div>
          </Card>
        </div>
      )}

      {/* Action Feedback Error */}
      {actionError && !showStepUp && !confirmationReq && (
         <div className="fixed bottom-10 right-10 z-50 animate-in slide-in-from-bottom-4">
            <ErrorMessage message={actionError} action={{ label: "Dismiss", onClick: () => setActionError(null) }} />
         </div>
      )}

      {isEmergencyActive && (
        <div className="fixed top-16 left-72 right-0 bg-red-600 text-white py-2 px-12 z-40 flex items-center justify-center gap-4 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-white" />
          <span className="text-[10px] font-black uppercase tracking-[0.5em]">Global Operational Lockdown Active — Limited Investigation Mode Only</span>
          <div className="w-2 h-2 rounded-full bg-white" />
        </div>
      )}

      <div className="flex justify-between items-start">
        <PageHeader title="Control Center" subtitle="Immutable Ledger & Identity Governance" />
        <div className="flex flex-col items-end gap-3 pt-4">
          <div className={`flex items-center gap-3 px-5 py-2.5 rounded-full border ${profile?.is_verified_admin ? 'bg-green-50 border-green-100 text-green-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${profile?.is_verified_admin ? 'bg-green-500' : 'bg-blue-500'}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Clearance: {clearanceLevel}</span>
          </div>
          <div 
            className={`flex items-center gap-3 px-5 py-2.5 rounded-full border transition-colors cursor-pointer ${chainValid === false ? 'bg-red-50 border-red-100 text-red-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
            onClick={runManualIntegrityCheck}
          >
            <div className={`w-2 h-2 rounded-full ${verifyingChain ? 'animate-spin border-t-2 border-current' : chainValid ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              {verifyingChain ? 'Verifying...' : chainValid ? 'Chain: Valid' : 'Chain: Error'}
            </span>
          </div>
        </div>
      </div>

      <Tabs 
        tabs={['Overview', 'Controls', 'Users', 'Safety Monitor', 'System Diagnosis', 'Activity Logs', 'Audit Ledger']} 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />

      <div className="min-h-[400px]">
        {activeTab === 'Overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            <StatCard label="Total Identities" value={platformStats?.totalUsers || 0} />
            <StatCard label="Active Users (24h)" value={platformStats?.activeUsers || 0} />
            <StatCard label="Analyses Run" value={platformStats?.totalAnalyses || 0} />
            <StatCard label="Tokens Consumed" value={platformStats?.tokensConsumed || 0} />
            <StatCard label="Failed/Refunded" value={platformStats?.failedAnalyses || 0} />
            
            <div className="lg:col-span-1">
              <Card className="!p-8 h-full">
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">System Integrity</p>
                 <div className="flex items-center gap-4">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center ${allDiagnosticsPassed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {allDiagnosticsPassed ? '✓' : '!'}
                   </div>
                   <div>
                     <p className="text-xl font-black text-[#0B0B0B] leading-none">
                       {allDiagnosticsPassed ? 'VERIFIED' : 'ATTENTION'}
                     </p>
                     <p className="text-[10px] text-gray-400 mt-1">Diagnostic Circuit Check</p>
                   </div>
                 </div>
              </Card>
            </div>
            
             <div className="lg:col-span-1">
               <Card title="System Kill Switch" className={`!border-2 transition-colors ${isEmergencyActive ? 'border-red-600 bg-red-50' : 'border-gray-100'}`}>
                  <p className="text-[11px] font-medium text-gray-500 leading-relaxed mb-8">
                    {isEmergencyActive 
                      ? "System is currently frozen. Only recovery actions and lockdown release are permitted." 
                      : "Immediately freeze all platform operations, AI processing, and authentication."}
                  </p>
                  <button 
                    disabled={profile?.role !== 'super_admin'}
                    onClick={() => initiateAction('TOGGLE_LOCKDOWN', 'GLOBAL', { active: !isEmergencyActive })}
                    className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all ${
                      isEmergencyActive 
                        ? 'bg-green-600 text-white hover:bg-green-700' 
                        : 'bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-600/20'
                    } disabled:opacity-20`}
                  >
                    {isEmergencyActive ? 'Release Operational Lockdown' : 'Activate System Lockdown'}
                  </button>
               </Card>
            </div>
          </div>
        )}

        {activeTab === 'Controls' && adminSettings && (
          <div className="space-y-12 animate-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card title="Global Operational Controls">
                <div className="space-y-6">
                  <ToggleSwitch 
                    label="Maintenance Mode" 
                    checked={adminSettings.maintenance_mode}
                    color="bg-yellow-500" 
                    onChange={() => initiateAction('UPDATE_SETTINGS', undefined, { 
                      name: 'Maintenance Mode', 
                      value: !adminSettings.maintenance_mode ? 'ON' : 'OFF',
                      changes: { maintenance_mode: !adminSettings.maintenance_mode }
                    })} 
                  />
                  <p className="text-xs text-gray-400 px-2">Blocks normal user access. Admins retain dashboard access.</p>
                  
                  <ToggleSwitch 
                    label="Pause All Analyses" 
                    checked={adminSettings.analyses_paused}
                    color="bg-red-500" 
                    onChange={() => initiateAction('UPDATE_SETTINGS', undefined, { 
                      name: 'Global Pause', 
                      value: !adminSettings.analyses_paused ? 'PAUSED' : 'ACTIVE',
                      changes: { analyses_paused: !adminSettings.analyses_paused }
                    })} 
                  />
                  <p className="text-xs text-gray-400 px-2">Immediately halts all neural engine processing. Billing is suspended.</p>
                </div>
              </Card>

              <Card title="Module Availability">
                <div className="space-y-4">
                  {Object.keys(adminSettings.modules_enabled).map((module) => (
                    <ToggleSwitch 
                      key={module}
                      label={module} 
                      checked={adminSettings.modules_enabled[module as keyof typeof adminSettings.modules_enabled]}
                      color="bg-green-500"
                      onChange={() => {
                        const newState = !adminSettings.modules_enabled[module as keyof typeof adminSettings.modules_enabled];
                        initiateAction('UPDATE_SETTINGS', undefined, { 
                          name: `${module} Module`, 
                          value: newState ? 'ENABLED' : 'DISABLED',
                          changes: { 
                            modules_enabled: { 
                              ...adminSettings.modules_enabled, 
                              [module]: newState 
                            } 
                          }
                        });
                      }} 
                    />
                  ))}
                </div>
              </Card>
            </div>
            
            <div className="text-right text-xs text-gray-400 font-mono">
              Last Config Update: {adminSettings.last_updated ? new Date(adminSettings.last_updated).toLocaleString() : 'Never'} by {adminSettings.updated_by || 'System'}
            </div>
          </div>
        )}

        {activeTab === 'Users' && (
          <Card className="!p-0 overflow-hidden">
            {users.length === 0 ? (
                <div className="p-12 text-center text-gray-400 font-medium">No users found.</div>
            ) : (
                <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                    <th className="px-8 py-6 text-[10px] uppercase font-bold text-gray-400">Identity</th>
                    <th className="px-8 py-6 text-[10px] uppercase font-bold text-gray-400">Plan</th>
                    <th className="px-8 py-6 text-[10px] uppercase font-bold text-gray-400">Role</th>
                    <th className="px-8 py-6 text-[10px] uppercase font-bold text-gray-400">Tokens</th>
                    <th className="px-8 py-6 text-[10px] uppercase font-bold text-gray-400">Status</th>
                    <th className="px-8 py-6 text-[10px] uppercase font-bold text-gray-400 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-8 py-6">
                        <p className="text-sm font-bold text-[#0B0B0B]">{u.email}</p>
                        <p className="text-[10px] text-gray-400 font-medium">Last: {u.last_active ? new Date(u.last_active).toLocaleDateString() : 'Never'}</p>
                        </td>
                        <td className="px-8 py-6">
                            <button 
                                onClick={() => initiateAction('changePlan', u.id, { plan: u.tier === 'free' ? 'pro' : 'free' })}
                                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all hover:opacity-80 ${u.tier === 'pro' ? 'bg-[#FF0000] text-white border-[#FF0000]' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                            >
                                {u.tier}
                            </button>
                        </td>
                        <td className="px-8 py-6">
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${u.role !== 'user' ? 'text-blue-600' : 'text-gray-400'}`}>
                                {u.role === 'user' ? 'User' : 'Admin'}
                            </span>
                        </td>
                        <td className="px-8 py-6">
                            <span className="text-sm font-bold text-[#0B0B0B]">{u.tokens}</span>
                        </td>
                        <td className="px-8 py-6">
                        <span className={`text-[9px] font-bold uppercase px-3 py-1 rounded-full border ${u.is_suspended ? 'border-red-500 text-red-500 bg-red-50' : 'border-green-500 text-green-500 bg-green-50'}`}>
                            {u.is_suspended ? 'Disabled' : 'Active'}
                        </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                            {/* TOKEN RESET */}
                            <button 
                                onClick={() => initiateAction('resetTokens', u.id)}
                                disabled={isEmergencyActive}
                                className="p-2 text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-30"
                                title="Reset Tokens"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                            </button>

                            {/* PROMOTE / DEMOTE */}
                            {u.role === 'user' ? (
                                <button 
                                    onClick={() => initiateAction('promoteToAdmin', u.id)}
                                    disabled={isEmergencyActive}
                                    className="p-2 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-30"
                                    title="Promote to Admin"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11.25l-3-3m0 0l-3 3m3-3v7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </button>
                            ) : (
                                <button 
                                    onClick={() => initiateAction('demoteAdmin', u.id)}
                                    disabled={isEmergencyActive}
                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-30"
                                    title="Revoke Admin"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </button>
                            )}

                            {/* DISABLE / ENABLE */}
                            <button 
                                onClick={() => initiateAction('toggleStatus', u.id, { targetStatus: u.is_suspended ? 'active' : 'disabled' })}
                                disabled={isEmergencyActive}
                                className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 ${u.is_suspended ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
                            >
                                {u.is_suspended ? 'Enable' : 'Disable'}
                            </button>
                        </div>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            )}
          </Card>
        )}

        {activeTab === 'Safety Monitor' && (
          <div className="space-y-12">
            {/* Real System Health based on Action Logs */}
            <Card title="System Health Status" accent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recent Failure Rate (24h)</p>
                    <div className="flex items-center gap-4">
                       <span className={`text-4xl font-black ${failureRate > 5 ? 'text-red-500' : 'text-green-500'}`}>
                          {failureRate.toFixed(1)}%
                       </span>
                       <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${failureRate > 5 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                          {failureRate > 5 ? 'DEGRADED' : 'HEALTHY'}
                       </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                       Calculated from {actionLogs.filter(l => (Date.now() - (l.created_at?.toMillis() || 0)) < 86400000).length} recent operations.
                    </p>
                 </div>
                 <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last Failure Event</p>
                    <p className="text-xl font-bold text-[#0B0B0B]">
                       {lastFailure || 'No recent failures'}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                       Most recent 'failed_refunded' status.
                    </p>
                 </div>
              </div>
            </Card>

            <Card title="Security Exceptions Ledger">
              {securityLogs.length === 0 ? (
                <p className="text-gray-400 text-sm italic py-8">Zero security signatures detected.</p>
              ) : (
                <div className="space-y-4">
                  {securityLogs.map(log => (
                    <div key={log.id} className={`p-8 border rounded-[32px] flex flex-col gap-4 ${log.severity === 'critical' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${log.severity === 'critical' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{log.event_type}</span>
                        <span className="text-[10px] font-bold text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-600 italic">"{log.details}"</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'System Diagnosis' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-[#0B0B0B]">Regression & Integrity Suite</h3>
                <p className="text-sm text-gray-500 mt-2">Automated verification of feature contracts, input/output validation logic, and circuit breaker health.</p>
              </div>
              <PrimaryButton onClick={runDiagnostics} disabled={runningDiagnostics}>
                {runningDiagnostics ? 'Running Suite...' : 'Run Auto-Diagnostics'}
              </PrimaryButton>
            </div>
            
            {diagnosticResults.length > 0 && (
               <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-bottom-4 duration-500">
                  {diagnosticResults.map(res => (
                    <div key={res.id} className={`p-6 rounded-2xl border flex items-center justify-between ${res.status === 'PASS' ? 'bg-green-50 border-green-100' : res.status === 'WARN' ? 'bg-yellow-50 border-yellow-100' : 'bg-red-50 border-red-100'}`}>
                       <div className="flex items-center gap-4">
                         <div className={`w-3 h-3 rounded-full ${res.status === 'PASS' ? 'bg-green-500' : res.status === 'WARN' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                         <div>
                           <p className="text-sm font-bold text-[#0B0B0B]">{res.name}</p>
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{res.category}</p>
                         </div>
                       </div>
                       <div className="text-right">
                         <span className={`text-[11px] font-black uppercase px-3 py-1 rounded-full ${res.status === 'PASS' ? 'text-green-600 bg-green-100' : res.status === 'WARN' ? 'text-yellow-600 bg-yellow-100' : 'text-red-600 bg-red-100'}`}>
                           {res.status}
                         </span>
                         {res.message && <p className="text-[10px] font-bold text-gray-500 mt-2 max-w-md">{res.message}</p>}
                       </div>
                    </div>
                  ))}
               </div>
            )}
            
            {diagnosticResults.length === 0 && !runningDiagnostics && (
              <Card className="flex flex-col items-center justify-center py-20 bg-gray-50 border-dashed">
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No Diagnostic Data Available</p>
                <p className="text-gray-300 text-sm mt-2">Run the suite to detect regressions.</p>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'Activity Logs' && (
          <div className="space-y-6">
             <div className="flex gap-4 mb-6">
               <select 
                 className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold uppercase tracking-widest text-gray-600"
                 value={logFilterModule}
                 onChange={(e) => setLogFilterModule(e.target.value)}
               >
                 <option value="All">All Modules</option>
                 <option value="AngleMiner_Generate">AngleMiner</option>
                 <option value="AngleMiner X">AngleMiner (Client)</option>
                 <option value="TestLab_Simulation">TestLab</option>
                 <option value="ConversionDoctor_Audit">Conversion Doctor</option>
               </select>
               <select 
                 className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold uppercase tracking-widest text-gray-600"
                 value={logFilterStatus}
                 onChange={(e) => setLogFilterStatus(e.target.value)}
               >
                 <option value="All">All Statuses</option>
                 <option value="Success">Success</option>
                 <option value="Failed">Failed</option>
                 <option value="Blocked">Blocked</option>
                 <option value="Client">Client Only</option>
               </select>
             </div>
             
             <Card className="!p-0 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-8 py-6 text-[10px] uppercase font-bold text-gray-400">Timestamp</th>
                      <th className="px-8 py-6 text-[10px] uppercase font-bold text-gray-400">User</th>
                      <th className="px-8 py-6 text-[10px] uppercase font-bold text-gray-400">Module</th>
                      <th className="px-8 py-6 text-[10px] uppercase font-bold text-gray-400">Action</th>
                      <th className="px-8 py-6 text-[10px] uppercase font-bold text-gray-400">Status</th>
                      <th className="px-8 py-6 text-[10px] uppercase font-bold text-gray-400">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {getFilteredLogs().map(log => {
                      const date = log.created_at ? new Date(log.created_at.toMillis()) : new Date(log.timestamp || 0);
                      return (
                        <tr key={log.id} className="hover:bg-gray-50/50">
                          <td className="px-8 py-6 text-xs font-medium text-gray-600">{date.toLocaleString()}</td>
                          <td className="px-8 py-6 text-xs font-bold text-[#0B0B0B]">{log.user_id || log.uid || 'Unknown'}</td>
                          <td className="px-8 py-6 text-[10px] uppercase font-bold text-gray-500">{log.module}</td>
                          <td className="px-8 py-6 text-xs font-medium text-gray-600 truncate max-w-[200px]">{log.action || 'Analysis'}</td>
                          <td className="px-8 py-6">
                             {log.status ? (
                               <span className={`text-[9px] font-bold uppercase px-3 py-1 rounded-full ${
                                 log.status === 'success' ? 'bg-green-50 text-green-600' : 
                                 log.status === 'blocked' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'
                               }`}>
                                 {log.status === 'failed_refunded' ? 'Failed' : log.status === 'blocked' ? 'Blocked' : 'Success'}
                               </span>
                             ) : (
                               <span className="text-[9px] font-bold uppercase text-gray-300">Client Action</span>
                             )}
                             {log.error_code && <p className="text-[9px] text-red-500 mt-1 truncate max-w-[150px]">{log.error_code}</p>}
                          </td>
                          <td className="px-8 py-6 text-xs font-bold text-gray-600">
                            {log.tokens_used !== undefined ? log.tokens_used : '-'}
                          </td>
                        </tr>
                      );
                    })}
                    {getFilteredLogs().length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-8 py-12 text-center text-gray-400 text-sm italic">
                          No activity logs found matching criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
             </Card>
          </div>
        )}

        {activeTab === 'Audit Ledger' && (
          <div className="space-y-6">
             <div className="flex justify-between items-center px-10">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Immutable Block Sequence</p>
                <button 
                  onClick={runManualIntegrityCheck}
                  className="text-[10px] font-bold text-blue-500 hover:underline uppercase tracking-widest"
                >
                  Verify Sequence
                </button>
             </div>
             <div className="space-y-4">
                {auditLogs.map(log => (
                  <div key={log.id} className="p-8 bg-white border border-gray-100 rounded-[32px] flex flex-col gap-4 hover:shadow-lg transition-all group">
                    <div className="flex justify-between items-start">
                       <div className="flex items-center gap-4">
                         <div className="w-2 h-2 rounded-full bg-blue-500" />
                         <span className="text-[13px] font-black uppercase text-[#0B0B0B]">{log.action_type}</span>
                       </div>
                       <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-8 text-[11px]">
                       <div>
                         <p className="font-bold text-gray-400 uppercase tracking-widest mb-1">Actor</p>
                         <p className="font-bold text-[#0B0B0B]">{log.admin_email}</p>
                       </div>
                       <div>
                         <p className="font-bold text-gray-400 uppercase tracking-widest mb-1">Target</p>
                         <p className="font-bold text-[#0B0B0B] truncate">{log.target}</p>
                       </div>
                    </div>
                    {log.metadata && log.metadata.changes && (
                      <div className="pt-4 border-t border-gray-50">
                        <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2">Change Delta</p>
                        <pre className="text-[9px] font-mono text-gray-500 bg-gray-50 p-2 rounded-lg overflow-x-auto">
                          {JSON.stringify(log.metadata.changes, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="pt-4 border-t border-gray-50 flex flex-col gap-2">
                       <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">Block Hash Signature</p>
                       <code className="text-[10px] font-mono text-gray-400 break-all bg-gray-50 p-2 rounded-lg">{log.hash}</code>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value }: { label: string; value: string | number }) => (
  <Card className="!p-8">
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">{label}</p>
    <p className="text-3xl font-black text-[#0B0B0B]">{value}</p>
  </Card>
);

export default AdminDashboard;
