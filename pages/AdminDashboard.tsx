
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, PageHeader, LoadingState, Tabs, ErrorMessage, PrimaryButton, Input, IntelligenceIndicator } from '../components/UI';
import { adminGetAllUsers, adminGetAuditLogs, adminGetSecurityLogs, adminSuspendUser, adminUpdateUserTokens, updateSystemEmergency, getSystemSettings } from '../services/persistenceService';
import { SecurityEngine } from '../services/securityEngine';
import { DiagnosisEngine } from '../services/diagnosisService';
import { UserProfile, AuditLogEntry, SecurityEvent, SystemLoadLevel, SystemSettings, DiagnosticResult } from '../types';

interface ConfirmationRequest {
  type: 'SUSPEND' | 'UPDATE_TOKENS' | 'TOGGLE_LOCKDOWN';
  userId: string;
  payload?: any;
  warningTitle: string;
  warningMessage: string;
  keyword: string;
}

const AdminDashboard: React.FC = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('Overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemLoad, setSystemLoad] = useState<{ level: SystemLoadLevel, score: number, percentage: number }>(SecurityEngine.getSystemLoadLevel());
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

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

  // Token Update Local State
  const [newTokenValues, setNewTokenValues] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!authLoading && (!profile || profile.role === 'user')) navigate('/');
  }, [profile, authLoading, navigate]);

  const load = async () => {
    setLoading(true);
    const [u, logs, sLogs, settings] = await Promise.all([
      adminGetAllUsers(), 
      adminGetAuditLogs(),
      adminGetSecurityLogs(),
      getSystemSettings()
    ]);
    setUsers(u);
    setAuditLogs(logs);
    setSecurityLogs(sLogs);
    setSystemSettings(settings);
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
  const initiateAction = (type: ConfirmationRequest['type'], userId: string, payload?: any) => {
    let req: ConfirmationRequest;
    if (type === 'TOGGLE_LOCKDOWN') {
      const active = payload.active;
      req = {
        type, userId, payload,
        warningTitle: active ? "ACTIVATE SYSTEM LOCKDOWN" : "RELEASE SYSTEM LOCKDOWN",
        warningMessage: active 
          ? "This will immediately halt all neural operations, suspend authentication, and block user access. This is a drastic emergency measure."
          : "This will restore full system functionality and allow user access.",
        keyword: active ? "LOCKDOWN" : "RELEASE"
      };
    } else if (type === 'SUSPEND') {
      req = {
        type, userId, payload,
        warningTitle: "REVOKE IDENTITY ACCESS",
        warningMessage: "The user will be immediately disconnected and prevented from signing in. This action is logged to the immutable ledger.",
        keyword: "SUSPEND"
      };
    } else {
      // Non-destructive (relatively), skip confirmation modal
      req = { type, userId, payload, warningTitle: "", warningMessage: "", keyword: "" };
      handleConfirmedAction(req);
      return;
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

    const scope = req.type === 'TOGGLE_LOCKDOWN' ? 'admin:system_config' : 'admin:user_management';
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
      if (req.type === 'SUSPEND') {
        await adminSuspendUser(profile!, req.userId, "Security Suspension");
      } else if (req.type === 'UPDATE_TOKENS') {
        await adminUpdateUserTokens(profile!, req.userId, req.payload.tokens);
      } else if (req.type === 'TOGGLE_LOCKDOWN') {
        await updateSystemEmergency(profile!, req.payload.active);
      }
      await load();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  if (authLoading || loading) return <LoadingState message="Synchronizing Strategic Ledger..." />;

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
        tabs={['Overview', 'Users', 'Safety Monitor', 'System Diagnosis', 'Audit Ledger']} 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />

      <div className="min-h-[400px]">
        {activeTab === 'Overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            <StatCard label="Identities" value={users.length} />
            <div className="lg:col-span-1">
              <Card className="!p-8">
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">System Integrity</p>
                 <div className="flex items-center gap-4">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center ${allDiagnosticsPassed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {allDiagnosticsPassed ? '✓' : '!'}
                   </div>
                   <p className="text-xl font-black text-[#0B0B0B]">
                     {allDiagnosticsPassed ? 'VERIFIED' : 'ATTENTION NEEDED'}
                   </p>
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

        {activeTab === 'Users' && (
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-10 py-6 text-[10px] uppercase font-bold text-gray-400">Identity</th>
                  <th className="px-10 py-6 text-[10px] uppercase font-bold text-gray-400">Clearance</th>
                  <th className="px-10 py-6 text-[10px] uppercase font-bold text-gray-400">Risk</th>
                  <th className="px-10 py-6 text-[10px] uppercase font-bold text-gray-400">Credits</th>
                  <th className="px-10 py-6 text-[10px] uppercase font-bold text-gray-400">Status</th>
                  <th className="px-10 py-6 text-[10px] uppercase font-bold text-gray-400">Intervention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="px-10 py-6">
                      <p className="text-sm font-bold text-[#0B0B0B]">{u.email}</p>
                      <p className="text-[10px] text-gray-400 font-medium">Last Active: {u.last_active ? new Date(u.last_active).toLocaleDateString() : 'Never'}</p>
                    </td>
                    <td className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">{u.role}</td>
                    <td className="px-10 py-6">
                       <span className={`text-sm font-black ${u.risk_score && u.risk_score > 50 ? 'text-red-500' : 'text-green-500'}`}>{u.risk_score || 0}</span>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <input 
                          disabled={isEmergencyActive}
                          type="number"
                          className="w-16 bg-transparent border-b border-gray-200 text-xs font-bold focus:outline-none disabled:opacity-30"
                          value={newTokenValues[u.id] ?? u.tokens}
                          onChange={(e) => setNewTokenValues({...newTokenValues, [u.id]: parseInt(e.target.value)})}
                        />
                        <button 
                          disabled={isEmergencyActive}
                          onClick={() => initiateAction('UPDATE_TOKENS', u.id, { tokens: newTokenValues[u.id] })}
                          className="text-[9px] font-bold text-blue-500 hover:opacity-60 uppercase tracking-widest disabled:opacity-20"
                        >
                          Sync
                        </button>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <span className={`text-[9px] font-bold uppercase px-3 py-1 rounded-full border ${u.is_suspended ? 'border-red-500 text-red-500 bg-red-50' : 'border-green-500 text-green-500 bg-green-50'}`}>
                        {u.is_suspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="px-10 py-6">
                      {!u.is_suspended && u.role === 'user' && (
                        <button 
                          disabled={isEmergencyActive}
                          onClick={() => initiateAction('SUSPEND', u.id)}
                          className="text-[9px] font-bold text-red-500 uppercase tracking-widest hover:underline disabled:opacity-20"
                        >
                          Revoke Access
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {activeTab === 'Safety Monitor' && (
          <div className="space-y-12">
            <Card title="Compute Pressure" accent>
              <div className="flex items-center gap-8">
                <div className="h-32 w-1.5 bg-gray-100 rounded-full relative overflow-hidden">
                   <div className={`absolute bottom-0 left-0 w-full transition-all duration-1000 ${systemLoad.level === 'NORMAL' ? 'bg-green-500' : 'bg-red-500'}`} style={{ height: `${systemLoad.percentage}%` }} />
                </div>
                <div>
                   <h3 className="text-4xl font-black text-[#0B0B0B] mb-2">{Math.round(systemLoad.percentage)}%</h3>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Strategic Load Indicator</p>
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
