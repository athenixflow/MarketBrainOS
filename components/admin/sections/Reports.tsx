// Report Management — platform data exports plus a directory of every report (admin-readable after
// the firestore.rules admin-read addition). Rows open report detail; archive/delete via adminManageReport.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, AdminTable, KpiCard, Pill, Column } from '../primitives';
import { adminCan } from '../../../config/adminAccess';
import { downloadAsCSV, paymentsToCSV } from '../../../services/exportService';
import { callAdminManageReport } from '../../../services/persistenceService';
import { Report } from '../../../types';
import { fmtDate, fmtDateTime } from '../util';

const Reports: React.FC = () => {
  const a = useAdmin();
  const navigate = useNavigate();
  const canDelete = adminCan(a.profile?.role, 'content', 'delete');

  const exportUsers = () => downloadAsCSV('MarketBrainOS_Users', [
    ['User ID', 'Email', 'Company', 'Plan', 'Status', 'Tokens', 'Role', 'Last Active'],
    ...a.users.map(u => [u.id || '', u.email || '', u.company_name || '', u.tier, u.is_suspended ? 'suspended' : 'active', String(u.tokens ?? ''), u.role, fmtDateTime(u.last_active)]),
  ]);
  const exportActivity = () => downloadAsCSV('MarketBrainOS_Activity', [
    ['Time', 'User', 'Module', 'Status', 'Tokens', 'Error'],
    ...a.actionLogs.map(l => [fmtDateTime(l.created_at || l.timestamp), l.uid || l.user_id || '', l.module || '', l.status || 'client', String(l.tokens_used ?? ''), l.error_code || '']),
  ]);
  const exportRevenue = () => downloadAsCSV('MarketBrainOS_Revenue', paymentsToCSV(a.payments));

  const archive = (r: Report) => a.confirm({ scope: 'admin:system_config', keyword: 'CONFIRM', warningTitle: 'ARCHIVE REPORT', warningMessage: `Archive "${r.title}".`, run: async () => { await callAdminManageReport(r.id!, 'archive'); } });
  const del = (r: Report) => a.confirm({ scope: 'admin:system_config', keyword: 'DELETE', warningTitle: 'DELETE REPORT', warningMessage: `Permanently delete "${r.title}". This cannot be undone.`, run: async () => { await callAdminManageReport(r.id!, 'delete'); } });

  const columns: Column<Report>[] = [
    { key: 'title', header: 'Title', render: r => <button onClick={() => navigate(`/admin/reports/${r.id}`)} className="text-sm font-bold text-[#0B0B0B] hover:text-[#FF0000] text-left truncate block max-w-[220px]">{r.title || 'Untitled'}</button> },
    { key: 'type', header: 'Type', render: r => <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{r.report_type || '—'}</span> },
    { key: 'vis', header: 'Visibility', render: r => <Pill tone={r.visibility_type === 'private' ? 'gray' : 'blue'}>{r.visibility_type || 'private'}</Pill> },
    { key: 'creator', header: 'Creator', render: r => <span className="text-xs text-gray-500 truncate block max-w-[140px]">{r.creator_user_id}</span> },
    { key: 'date', header: 'Created', render: r => <span className="text-xs text-gray-500">{fmtDate(r.created_at)}</span> },
    { key: 'actions', header: 'Actions', align: 'right', render: r => canDelete ? (
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => archive(r)} className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:text-[#0B0B0B]">Archive</button>
        <button onClick={() => del(r)} className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500">Delete</button>
      </div>
    ) : <button onClick={() => navigate(`/admin/reports/${r.id}`)} className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:text-[#0B0B0B]">View</button> },
  ];

  const Btn: React.FC<{ onClick: () => void; label: string; sub: string }> = ({ onClick, label, sub }) => (
    <Card className="flex items-center justify-between">
      <div><p className="text-sm font-bold text-[#0B0B0B]">{label}</p><p className="text-xs text-gray-400 font-medium mt-1">{sub}</p></div>
      <button onClick={onClick} className="px-5 py-2.5 rounded-xl bg-[#FF0000] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#D40000]">Export CSV</button>
    </Card>
  );

  return (
    <div className="space-y-12">
      <AdminSectionHeader title="Report Management" subtitle="All reports generated across the platform, plus dataset exports." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="Total Reports" value={a.reports.length} accent />
        <KpiCard label="Team Reports" value={a.reports.filter(r => r.visibility_type === 'team').length} />
        <KpiCard label="Client Reports" value={a.reports.filter(r => r.visibility_type === 'client').length} />
        <KpiCard label="Enterprise Reports" value={a.reports.filter(r => r.visibility_type === 'enterprise').length} />
      </div>

      <AdminTable rows={a.reports} columns={columns} searchKeys={[r => r.title || '', r => r.creator_user_id || '']}
        searchPlaceholder="Search reports…" empty="No reports found (admin read requires the rules deploy)." />

      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mb-4">Dataset Exports</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Btn onClick={exportUsers} label="User Report" sub={`${a.users.length} accounts`} />
          <Btn onClick={exportRevenue} label="Revenue Report" sub={`${a.payments.length} transactions`} />
          <Btn onClick={exportActivity} label="Activity Report" sub={`${a.actionLogs.length} events`} />
        </div>
      </div>
    </div>
  );
};

export default Reports;
