// Admin Portal — the dedicated control-center shell. Provides shared admin state (AdminProvider),
// renders the Control Center header (clearance + ledger-integrity badges + lockdown banner), and
// routes to the section components. The grouped section navigation is rendered by the App sidebar
// (admin branch) from config/adminAccess.ts.

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { PageHeader, LoadingState } from '../UI';
import { AdminProvider, useAdmin } from './AdminContext';

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
import Revenue from './sections/Revenue';
import Reports from './sections/Reports';
import Audit from './sections/Audit';
import Security from './sections/Security';
import AdminSettings from './sections/AdminSettings';
import { AdminNotifications, AdminSupport, AdminContent } from './sections/System';
import Placeholder from './sections/Placeholder';

const AdminPortalInner: React.FC = () => {
  const a = useAdmin();
  const clearance = a.profile?.is_verified_admin ? 'Level 2: VERIFIED' : 'Level 1: READ_ONLY';

  if (a.loading && a.users.length === 0) return <LoadingState message="Synchronizing Strategic Ledger..." />;

  return (
    <div className="space-y-12 pb-32 relative">
      {a.isEmergencyActive && (
        <div className="fixed top-16 left-0 lg:left-72 right-0 bg-red-600 text-white py-2 px-12 z-40 flex items-center justify-center gap-4 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-white" />
          <span className="text-[10px] font-black uppercase tracking-[0.5em]">Global Operational Lockdown Active — Limited Investigation Mode</span>
          <div className="w-2 h-2 rounded-full bg-white" />
        </div>
      )}

      <div className="flex justify-between items-start flex-wrap gap-6">
        <PageHeader title="Control Center" subtitle="Platform governance, monitoring & immutable ledgers" />
        <div className="flex flex-col items-end gap-3 pt-4">
          <div className={`flex items-center gap-3 px-5 py-2.5 rounded-full border ${a.profile?.is_verified_admin ? 'bg-green-50 border-green-100 text-green-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${a.profile?.is_verified_admin ? 'bg-green-500' : 'bg-blue-500'}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Clearance: {clearance}</span>
          </div>
          <div onClick={a.runManualIntegrityCheck}
            className={`flex items-center gap-3 px-5 py-2.5 rounded-full border cursor-pointer ${a.chainValid === false ? 'bg-red-50 border-red-100 text-red-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
            <div className={`w-2 h-2 rounded-full ${a.verifyingChain ? 'animate-spin border-t-2 border-current' : a.chainValid === false ? 'bg-red-500' : 'bg-green-500'}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{a.verifyingChain ? 'Verifying...' : a.chainValid === false ? 'Chain: Error' : 'Chain: Valid'}</span>
          </div>
        </div>
      </div>

      <div className="min-h-[400px]">
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
          <Route path="agencies" element={<OrgList kind="agency" />} />
          <Route path="enterprise" element={<OrgList kind="enterprise" />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="reports" element={<Reports />} />
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
