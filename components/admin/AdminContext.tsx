// Admin portal shared state + the destructive-action protocol (confirm keyword → optional step-up
// verification → execute → refresh). Ported from the original AdminDashboard and generalized: a
// request may carry a `run` thunk so any section can route a custom mutation through the same
// audited confirm/step-up flow. Exposes everything via useAdmin().

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  adminGetAllUsers, adminGetAuditLogs, adminGetSecurityLogs, adminGetActionLogs,
  adminGetPlatformStats, adminGetAllPayments, getSystemSettings, getAdminSettings,
  callAdminUserAction, updateSystemEmergency, callUpdateSystemSettings,
  computeSystemMetrics, PlatformStats, AdminUserAction, SystemMetrics,
} from '../../services/persistenceService';
import { SecurityEngine } from '../../services/securityEngine';
import {
  UserProfile, AuditLogEntry, SecurityEvent, SystemSettings, AdminSettings, ActionLogEntry,
  PaymentRecord, PermissionScope,
} from '../../types';
import { Card, Input, PrimaryButton, ErrorMessage } from '../UI';

export interface ConfirmRequest {
  warningTitle: string;
  warningMessage: string;
  keyword: string;
  scope?: PermissionScope;                 // drives step-up; default admin:user_management
  // Legacy typed path (existing user/system actions):
  type?: AdminUserAction | 'TOGGLE_LOCKDOWN' | 'UPDATE_SETTINGS';
  userId?: string;
  payload?: any;
  // Generic path: any custom mutation (new admin functions, bulk ops, etc.)
  run?: () => Promise<void>;
}

interface AdminContextValue {
  loading: boolean;
  profile: UserProfile | null;
  users: UserProfile[];
  auditLogs: AuditLogEntry[];
  securityLogs: SecurityEvent[];
  actionLogs: ActionLogEntry[];
  payments: PaymentRecord[];
  systemSettings: SystemSettings | null;
  adminSettings: AdminSettings | null;
  platformStats: PlatformStats | null;
  metrics: SystemMetrics;
  isEmergencyActive: boolean;
  failureRate: number;
  lastFailure: string | null;
  chainValid: boolean | null;
  verifyingChain: boolean;
  refresh: () => Promise<void>;
  confirm: (req: ConfirmRequest) => void;
  runManualIntegrityCheck: () => void;
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined);
export const useAdmin = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
};

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityEvent[]>([]);
  const [actionLogs, setActionLogs] = useState<ActionLogEntry[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [failureRate, setFailureRate] = useState(0);
  const [lastFailure, setLastFailure] = useState<string | null>(null);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [verifyingChain, setVerifyingChain] = useState(false);

  // Confirm + step-up modal state
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [showStepUp, setShowStepUp] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingAction, setPendingAction] = useState<ConfirmRequest | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const [u, logs, sLogs, aLogs, settings, admSettings, stats, pays] = await Promise.all([
      adminGetAllUsers(), adminGetAuditLogs(), adminGetSecurityLogs(), adminGetActionLogs(200),
      getSystemSettings(), getAdminSettings(), adminGetPlatformStats(), adminGetAllPayments(),
    ]);
    setUsers(u); setAuditLogs(logs); setSecurityLogs(sLogs); setActionLogs(aLogs);
    setSystemSettings(settings); setAdminSettings(admSettings); setPlatformStats(stats); setPayments(pays);

    const recent = aLogs.filter(l => {
      const t = l.created_at ? l.created_at.toMillis() : new Date(l.timestamp || 0).getTime();
      return (Date.now() - t) < 86400000;
    });
    const failures = recent.filter(l => l.status === 'failed_refunded');
    setFailureRate(recent.length ? (failures.length / recent.length) * 100 : 0);
    const lf = aLogs.find(l => l.status === 'failed_refunded');
    setLastFailure(lf ? (lf.created_at ? new Date(lf.created_at.toMillis()).toLocaleString() : new Date(lf.timestamp!).toLocaleString()) : null);

    setLoading(false);
    const verify = await SecurityEngine.verifyChainIntegrity(logs);
    setChainValid(verify.valid);
  };

  useEffect(() => { if (profile && profile.role !== 'user') refresh(); /* eslint-disable-next-line */ }, [profile]);

  const runManualIntegrityCheck = async () => {
    setVerifyingChain(true);
    const verify = await SecurityEngine.verifyChainIntegrity(auditLogs);
    setTimeout(() => { setChainValid(verify.valid); setVerifyingChain(false); }, 900);
  };

  const metrics = useMemo(() => computeSystemMetrics(actionLogs), [actionLogs]);
  const isEmergencyActive = !!systemSettings?.emergency_lockdown;

  const confirm = (req: ConfirmRequest) => { setConfirmReq(req); setConfirmInput(''); setActionError(null); };

  const handleConfirmed = async (req: ConfirmRequest) => {
    setConfirmReq(null);
    if (!profile) return;
    setActionError(null);
    const scope: PermissionScope = req.scope || (req.type === 'TOGGLE_LOCKDOWN' || req.type === 'UPDATE_SETTINGS' ? 'admin:system_config' : 'admin:user_management');
    const check = await SecurityEngine.checkPermission(profile, scope);
    if (check.stepUpRequired) { setPendingAction(req); setShowStepUp(true); return; }
    if (!check.allowed) { setActionError(check.error || 'Permission Denied.'); return; }
    execute(req);
  };

  const handleVerifyStepUp = async () => {
    if (!profile || !pendingAction) return;
    const res = await SecurityEngine.verifyStepUp(profile, verificationCode);
    if (res.valid) {
      profile.is_verified_admin = true; profile.last_verification = new Date().toISOString();
      setShowStepUp(false); setVerificationCode('');
      execute(pendingAction);
    } else { setActionError('Invalid verification code.'); }
  };

  const execute = async (req: ConfirmRequest) => {
    try {
      if (req.run) {
        await req.run();
      } else if (req.type === 'TOGGLE_LOCKDOWN') {
        await updateSystemEmergency(profile!, req.payload.active);
      } else if (req.type === 'UPDATE_SETTINGS') {
        await callUpdateSystemSettings(req.payload.changes);
      } else if (req.userId && req.type) {
        await callAdminUserAction(req.type as AdminUserAction, req.userId, req.payload);
      }
      await refresh();
    } catch (err: any) {
      setActionError(err.message || 'Action failed.');
    }
  };

  const value: AdminContextValue = {
    loading, profile, users, auditLogs, securityLogs, actionLogs, payments,
    systemSettings, adminSettings, platformStats, metrics, isEmergencyActive,
    failureRate, lastFailure, chainValid, verifyingChain, refresh, confirm, runManualIntegrityCheck,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}

      {/* CONFIRMATION MODAL */}
      {confirmReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0B0B]/95 backdrop-blur-md p-6">
          <div className="max-w-md w-full bg-[#1A1A1A] border-2 border-red-600 rounded-[32px] p-10 shadow-2xl shadow-red-900/40 animate-in zoom-in duration-300">
            <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] mb-4">Destructive Action Protocol</p>
            <h3 className="text-2xl font-black text-white mb-6 uppercase leading-none">{confirmReq.warningTitle}</h3>
            <p className="text-sm font-medium text-gray-400 mb-8 leading-relaxed">{confirmReq.warningMessage}</p>
            <div className="bg-black/50 p-6 rounded-2xl mb-8 border border-white/10">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Type the following to confirm:</p>
              <p className="text-xl font-mono text-white tracking-widest font-bold select-all">"{confirmReq.keyword}"</p>
            </div>
            <Input label="Confirmation Keyword" placeholder={confirmReq.keyword} value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)} />
            <div className="flex flex-col gap-4 mt-8">
              <button onClick={() => handleConfirmed(confirmReq)} disabled={confirmInput !== confirmReq.keyword}
                className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-[0.2em] rounded-xl hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all">Execute</button>
              <button onClick={() => setConfirmReq(null)} className="w-full py-3 text-xs font-bold text-gray-500 hover:text-white uppercase tracking-widest">Cancel Operation</button>
            </div>
          </div>
        </div>
      )}

      {/* STEP-UP MODAL */}
      {showStepUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0B0B]/90 backdrop-blur-sm p-6">
          <Card accent className="max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-xl font-black uppercase text-[#0B0B0B] mb-4">Identity Verification</h3>
            <p className="text-sm text-gray-500 mb-8 font-medium">Verify your administrative identity to proceed with this change.</p>
            <Input label="Verification Code" placeholder="000000" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} />
            {actionError && <div className="mb-6"><ErrorMessage message={actionError} /></div>}
            <div className="flex gap-4">
              <PrimaryButton className="flex-grow" onClick={handleVerifyStepUp}>Authorize</PrimaryButton>
              <button onClick={() => setShowStepUp(false)} className="px-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Cancel</button>
            </div>
          </Card>
        </div>
      )}

      {/* Toast error */}
      {actionError && !showStepUp && !confirmReq && (
        <div className="fixed bottom-10 right-10 z-50 animate-in slide-in-from-bottom-4">
          <ErrorMessage message={actionError} action={{ label: 'Dismiss', onClick: () => setActionError(null) }} />
        </div>
      )}
    </AdminContext.Provider>
  );
};
