// Admin Portal — the dedicated control-center shell. Provides shared admin state (AdminProvider),
// renders the Control Center header (clearance + ledger-integrity badges + lockdown banner), and
// routes to the section components. The grouped section navigation is rendered by the App sidebar
// (admin branch) from config/adminAccess.ts.

import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { PageHeader, LoadingState } from '../UI';
import { AdminProvider, useAdmin, AdminResource } from './AdminContext';

import Overview from './sections/Overview';
import Users from './sections/Users';
import UserDetail from './sections/UserDetail';
import Subscriptions from './sections/Subscriptions';
import Tokens from './sections/Tokens';
import Analyses from './sections/Analyses';
import Tools from './sections/Tools';
import AIOps from './sections/AIOps';
import PlatformHealth from './sections/PlatformHealth';
import FeatureFlags from './sections/FeatureFlags';
import OrgList from './sections/OrgList';
import WorkspaceDetail from './sections/WorkspaceDetail';
import AgencyDetail from './sections/AgencyDetail';
import ClientDetail from './sections/ClientDetail';
import EnterpriseDetail from './sections/EnterpriseDetail';
import Revenue from './sections/Revenue';
import PricingAdmin from './sections/Pricing';
import Transactions from './sections/Transactions';
import Refunds from './sections/Refunds';
import Reports from './sections/Reports';
import ReportDetail from './sections/ReportDetail';
import Audit from './sections/Audit';
import Security from './sections/Security';
import AdminSettings from './sections/AdminSettings';
import { AdminNotifications, AdminSupport, AdminContent } from './sections/System';
import Placeholder from './sections/Placeholder';

/*
 * What each section reads, so it is loaded when that section opens (and reloaded each time it is
 * opened, so the user list is never stale). Detail pages use their list's data. Anything not listed
 * (a new section) loads everything, which is slow but never wrong.
 */
const ALL: AdminResource[] = ['users', 'payments', 'reports', 'auditLogs', 'securityLogs', 'actionLogs', 'orgs'];
export const SECTION_DATA: Record<string, AdminResource[]> = {
  '': ['users', 'payments', 'actionLogs'],
  users: ['users'], subscriptions: ['users'], tokens: ['users', 'payments', 'actionLogs'],
  // `users` wherever a table names a person, so it shows their email (userLabel), not a raw uid.
  analyses: ['actionLogs', 'users'], tools: ['actionLogs'], 'ai-ops': ['actionLogs'], health: ['actionLogs'],
  flags: [], pricing: [], notifications: [], support: [], content: [], settings: ['users', 'securityLogs'],
  workspaces: ['orgs', 'reports', 'actionLogs', 'users'], agencies: ['orgs', 'actionLogs', 'users'], enterprise: ['orgs', 'users'],
  clients: ['reports', 'actionLogs'], revenue: ['payments', 'users'], transactions: ['payments', 'users'],
  refunds: ['payments', 'users'], reports: ['reports', 'users', 'payments', 'actionLogs'],
  audit: ['auditLogs', 'securityLogs', 'users'], security: ['securityLogs', 'auditLogs', 'actionLogs', 'users'],
};
const RESOURCE_LABEL: Record<AdminResource, string> = {
  users: 'users', payments: 'payments', reports: 'reports', auditLogs: 'audit log', securityLogs: 'security log', actionLogs: 'activity', orgs: 'organizations',
};
export const sectionData = (pathname: string): AdminResource[] => {
  const section = pathname.replace(/^\/admin\/?/, '').split('/')[0];
  return SECTION_DATA[section] ?? ALL;
};

const AdminPortalInner: React.FC = () => {
  const a = useAdmin();
  const { pathname } = useLocation();
  /* Destructive actions ask for a recent sign-in when they run; there is no standing clearance level. */
  const clearance = a.profile?.role === 'super_admin' ? 'Super admin' : 'Ops admin';
  // The section's data starts loading as soon as the portal opens; it does not wait for settings.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { a.ensure(sectionData(pathname), true); }, [pathname]);
  const waiting = sectionData(pathname).filter((k) => a.pending.has(k));

  if (a.loading && !a.systemSettings && !a.loadError) return <LoadingState message="Loading the control center…" />;

  if (a.loadError && !a.systemSettings) return (
    <div className="py-32 flex flex-col items-center text-center">
      <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6">!</div>
      <h3 className="text-xl font-bold text-white mb-2">Could not load the control center</h3>
      <p className="text-sm text-gray-400 max-w-md mb-8">{a.loadError}</p>
      <button onClick={() => a.refresh()} className="px-8 py-3 rounded-2xl bg-[#E00000] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#D40000]">Retry</button>
    </div>
  );

  return (
    <div className="space-y-12 pb-32 relative">
      {a.isEmergencyActive && (
        <div className="fixed top-16 left-0 lg:left-72 right-0 bg-red-600 text-white py-2 px-12 z-40 flex items-center justify-center gap-4 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-white" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Global Operational Lockdown Active — Limited Investigation Mode</span>
          <div className="w-2 h-2 rounded-full bg-white" />
        </div>
      )}

      <div className="flex justify-between items-start flex-wrap gap-6">
        <PageHeader title="Control Center" subtitle="Platform governance, monitoring & immutable ledgers" />
        <div className="flex flex-col items-end gap-3 pt-4">
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-full border bg-blue-50 border-blue-100 text-blue-700">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Role: {clearance}</span>
          </div>
          <div onClick={a.runManualIntegrityCheck}
            className={`flex items-center gap-3 px-5 py-2.5 rounded-full border cursor-pointer ${a.chainValid === false ? 'bg-red-50 border-red-100 text-red-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
            <div className={`w-2 h-2 rounded-full ${a.verifyingChain ? 'animate-spin border-t-2 border-current' : a.chainValid === false ? 'bg-red-500' : 'bg-green-500'}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{a.verifyingChain ? 'Verifying...' : a.chainValid === false ? 'Chain: Error' : a.chainValid === null ? 'Chain: Check' : 'Chain: Valid'}</span>
          </div>
        </div>
      </div>

      <div className="min-h-[400px]">
        {waiting.length > 0 && (
          <p role="status" className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Loading {waiting.map((k) => RESOURCE_LABEL[k]).join(', ')}…</p>
        )}
        <Routes>
          <Route index element={<Overview />} />
          <Route path="users" element={<Users />} />
          <Route path="users/:uid" element={<UserDetail />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="tokens" element={<Tokens />} />
          <Route path="analyses" element={<Analyses />} />
          <Route path="tools" element={<Tools />} />
          <Route path="ai-ops" element={<AIOps />} />
          <Route path="health" element={<PlatformHealth />} />
          <Route path="flags" element={<FeatureFlags />} />
          <Route path="workspaces" element={<OrgList kind="workspace" />} />
          <Route path="workspaces/:id" element={<WorkspaceDetail />} />
          <Route path="agencies" element={<OrgList kind="agency" />} />
          <Route path="agencies/:id" element={<AgencyDetail />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="enterprise" element={<OrgList kind="enterprise" />} />
          <Route path="enterprise/:id" element={<EnterpriseDetail />} />
          <Route path="pricing" element={<PricingAdmin />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="refunds" element={<Refunds />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports/:id" element={<ReportDetail />} />
          <Route path="audit" element={<Audit />} />
          <Route path="security" element={<Security />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="support" element={<AdminSupport />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="*" element={<Placeholder />} />
        </Routes>
      </div>
    </div>
  );
};

const AdminPortal: React.FC = () => (
  <AdminProvider>
    <AdminPortalInner />
  </AdminProvider>
);

export default AdminPortal;
