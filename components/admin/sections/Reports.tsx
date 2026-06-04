// Reports — platform data exports (users, revenue, activity) via the existing export service.
// A custom admin report builder is a documented follow-up.

import React from 'react';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, ComingSoonCard } from '../primitives';
import { downloadAsCSV, paymentsToCSV } from '../../../services/exportService';
import { fmtDateTime } from '../util';

const Reports: React.FC = () => {
  const a = useAdmin();

  const exportUsers = () => downloadAsCSV('MarketBrainOS_Users', [
    ['User ID', 'Email', 'Company', 'Plan', 'Status', 'Tokens', 'Role', 'Last Active'],
    ...a.users.map(u => [u.id || '', u.email || '', u.company_name || '', u.tier, u.is_suspended ? 'suspended' : 'active', String(u.tokens ?? ''), u.role, fmtDateTime(u.last_active)]),
  ]);
  const exportActivity = () => downloadAsCSV('MarketBrainOS_Activity', [
    ['Time', 'User', 'Module', 'Status', 'Tokens', 'Error'],
    ...a.actionLogs.map(l => [fmtDateTime(l.created_at || l.timestamp), l.uid || l.user_id || '', l.module || '', l.status || 'client', String(l.tokens_used ?? ''), l.error_code || '']),
  ]);
  const exportRevenue = () => downloadAsCSV('MarketBrainOS_Revenue', paymentsToCSV(a.payments));

  const Btn: React.FC<{ onClick: () => void; label: string; sub: string }> = ({ onClick, label, sub }) => (
    <Card className="!p-8 flex items-center justify-between">
      <div><p className="text-sm font-bold text-[#0B0B0B]">{label}</p><p className="text-xs text-gray-400 font-medium mt-1">{sub}</p></div>
      <button onClick={onClick} className="px-5 py-2.5 rounded-xl bg-[#FF0000] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#D40000]">Export CSV</button>
    </Card>
  );

  return (
    <div className="space-y-8">
      <AdminSectionHeader title="Reports" subtitle="Export platform datasets, or build custom reports (coming soon)." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Btn onClick={exportUsers} label="User Report" sub={`${a.users.length} accounts`} />
        <Btn onClick={exportRevenue} label="Revenue Report" sub={`${a.payments.length} transactions`} />
        <Btn onClick={exportActivity} label="Activity Report" sub={`${a.actionLogs.length} events`} />
      </div>
      <ComingSoonCard title="Custom Report Builder" description="Compose scheduled, filtered reports across users, analyses, tools, and revenue with PDF output." />
    </div>
  );
};

export default Reports;
