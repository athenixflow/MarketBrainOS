// Admin portal shared state + the destructive-action protocol (confirm keyword → execute → if the
// server wants a recent sign-in, "confirm it's you" and retry once → refresh). A request may carry
// a `run` thunk so any section can route a custom mutation through the same flow. Exposes
// everything via useAdmin().

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  adminGetAllUsers, adminGetAuditLogs, adminGetSecurityLogs, adminGetActionLogs,
  adminGetPlatformStats, adminGetAllPayments, getSystemSettings, getAdminSettings,
  adminGetWorkspaces, adminGetAgencies, adminGetEnterprises, adminGetAllReports,
  callAdminUserAction, updateSystemEmergency, callUpdateSystemSettings,
  computeSystemMetrics, PlatformStats, AdminUserAction, SystemMetrics,
} from '../../services/persistenceService';
import { SecurityEngine } from '../../services/securityEngine';
import {
  UserProfile, AuditLogEntry, SecurityEvent, SystemSettings, AdminSettings, ActionLogEntry,
  PaymentRecord, PermissionScope, Workspace, Agency, Enterprise, Report,
} from '../../types';
import { Input, PrimaryButton, ErrorMessage, Modal } from '../UI';
import { confirmIdentity, isReauthRequired, usesPassword } from '../../services/reauth';

// How many recent action_logs we sample for client-side analytics. Section metrics derived from
// this are a RECENT sample (not platform totals) — sections label them as such. Platform totals
// come from server aggregation (adminGetPlatformStats).
export const SAMPLE_SIZE = 500;

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
  workspaces: Workspace[];
  agencies: Agency[];
  enterprises: Enterprise[];
  reports: Report[];
  metrics: SystemMetrics;
  isEmergencyActive: boolean;
  failureRate: number;
  lastFailure: string | null;
  chainValid: boolean | null;
  /** Audit entries written before the chain fix: listed, but not verifiable. */
  chainLegacy: number;
  verifyingChain: boolean;
  loadError: string | null;
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
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityEvent[]>([]);
  const [actionLogs, setActionLogs] = useState<ActionLogEntry[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [failureRate, setFailureRate] = useState(0);
  const [lastFailure, setLastFailure] = useState<string | null>(null);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [chainLegacy, setChainLegacy] = useState(0);
  const [verifyingChain, setVerifyingChain] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Confirm + "confirm it's you" modal state
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [pendingAction, setPendingAction] = useState<ConfirmRequest | null>(null);   // waiting on re-auth
  const [reauthPwd, setReauthPwd] = useState('');
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [reauthBusy, setReauthBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [u, logs, sLogs, aLogs, settings, admSettings, stats, pays, ws, ag, en, reps] = await Promise.all([
        adminGetAllUsers(), adminGetAuditLogs(), adminGetSecurityLogs(), adminGetActionLogs(SAMPLE_SIZE),
        getSystemSettings(), getAdminSettings(), adminGetPlatformStats(), adminGetAllPayments(),
        adminGetWorkspaces(), adminGetAgencies(), adminGetEnterprises(), adminGetAllReports(),
      ]);
      setUsers(u); setAuditLogs(logs); setSecurityLogs(sLogs); setActionLogs(aLogs);
      setSystemSettings(settings); setAdminSettings(admSettings); setPlatformStats(stats); setPayments(pays);
      setWorkspaces(ws); setAgencies(ag); setEnterprises(en); setReports(reps);

      const recent = aLogs.filter(l => {
        const t = l.created_at ? l.created_at.toMillis() : new Date(l.timestamp || 0).getTime();
        return (Date.now() - t) < 86400000;
      });
      const failures = recent.filter(l => l.status === 'failed_refunded');
      setFailureRate(recent.length ? (failures.length / recent.length) * 100 : 0);
      const lf = aLogs.find(l => l.status === 'failed_refunded');
      setLastFailure(lf ? (lf.created_at ? new Date(lf.created_at.toMillis()).toLocaleString() : new Date(lf.timestamp!).toLocaleString()) : null);

      const verify = await SecurityEngine.verifyChainIntegrity(logs);
      setChainValid(verify.valid);
      setChainLegacy(verify.legacy);
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load admin data. Check your connection and clearance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (profile && profile.role !== 'user') refresh(); /* eslint-disable-next-line */ }, [profile]);

  const runManualIntegrityCheck = async () => {
    setVerifyingChain(true);
    const verify = await SecurityEngine.verifyChainIntegrity(auditLogs);
    setTimeout(() => { setChainValid(verify.valid); setChainLegacy(verify.legacy); setVerifyingChain(false); }, 900);
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
    if (!check.allowed) { setActionError(check.error || 'Permission Denied.'); return; }
    execute(req);
  };

  /* The server asked for a recent sign-in: confirm identity, then retry the same action once. */
  const confirmAndRetry = async () => {
    if (!user || !pendingAction) return;
    setReauthBusy(true); setReauthError(null);
    const problem = await confirmIdentity(user, reauthPwd);
    setReauthBusy(false);
    if (problem) { setReauthError(problem); return; }
    const req = pendingAction;
    closeReauth();
    execute(req, true);
  };
  const closeReauth = () => { setPendingAction(null); setReauthPwd(''); setReauthError(null); };

  const execute = async (req: ConfirmRequest, retried = false) => {
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
      if (!retried && isReauthRequired(err)) { setPendingAction(req); return; }
      setActionError(err.message || 'Action failed.');
    }
  };

  const value: AdminContextValue = {
    loading, profile, users, auditLogs, securityLogs, actionLogs, payments,
    systemSettings, adminSettings, platformStats, workspaces, agencies, enterprises, reports,
    metrics, isEmergencyActive,
    failureRate, lastFailure, chainValid, chainLegacy, verifyingChain, loadError, refresh, confirm, runManualIntegrityCheck,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}

      {/* CONFIRMATION: type the keyword, then Execute. */}
      <Modal open={!!confirmReq} onClose={() => setConfirmReq(null)} title={confirmReq?.warningTitle} size="sm">
        {confirmReq && (
          <form onSubmit={(e) => { e.preventDefault(); if (confirmInput === confirmReq.keyword) handleConfirmed(confirmReq); }}>
            <p className="text-sm font-medium text-gray-600 mb-6 leading-relaxed">{confirmReq.warningMessage}</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Type <span className="font-mono text-[#0B0B0B] select-all">{confirmReq.keyword}</span> to confirm</p>
            <Input label="Confirmation keyword" placeholder={confirmReq.keyword} value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)} />
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button type="submit" disabled={confirmInput !== confirmReq.keyword}
                className="flex-1 py-3.5 bg-red-700 text-white text-xs font-bold uppercase tracking-[0.2em] rounded-xl hover:bg-red-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Execute</button>
              <button type="button" onClick={() => setConfirmReq(null)} className="flex-1 py-3.5 text-xs font-bold text-gray-600 hover:text-[#0B0B0B] uppercase tracking-widest">Cancel</button>
            </div>
          </form>
        )}
      </Modal>

      {/* CONFIRM IT'S YOU: the server wants a recent sign-in before this action. */}
      <Modal open={!!pendingAction} onClose={closeReauth} title="Confirm it's you" size="sm">
        <form onSubmit={(e) => { e.preventDefault(); confirmAndRetry(); }}>
          <p className="text-sm font-medium text-gray-600 mb-6 leading-relaxed">
            Changes like this need a recent sign-in. {usesPassword(user) ? 'Enter your password to continue.' : 'Continue with Google to confirm.'}
          </p>
          {usesPassword(user) && (
            <Input label="Password" type="password" autoComplete="current-password" placeholder="Your account password" value={reauthPwd} onChange={(e) => setReauthPwd(e.target.value)} />
          )}
          {reauthError && <div className="mb-4"><ErrorMessage message={reauthError} /></div>}
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <PrimaryButton type="submit" className="flex-1" disabled={reauthBusy || (usesPassword(user) && !reauthPwd)}>
              {reauthBusy ? 'Checking…' : usesPassword(user) ? 'Confirm and continue' : 'Continue with Google'}
            </PrimaryButton>
            <button type="button" onClick={closeReauth} className="flex-1 py-3.5 text-xs font-bold text-gray-600 hover:text-[#0B0B0B] uppercase tracking-widest">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Toast error */}
      {actionError && !pendingAction && !confirmReq && (
        <div className="fixed bottom-10 right-10 z-50 animate-in slide-in-from-bottom-4">
          <ErrorMessage message={actionError} action={{ label: 'Dismiss', onClick: () => setActionError(null) }} />
        </div>
      )}
    </AdminContext.Provider>
  );
};
