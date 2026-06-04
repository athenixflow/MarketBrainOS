// Analysis Management — every analysis execution recorded in action_logs (the admin-readable source
// of truth). Directory with search/filters/pagination, success/failure analytics, and a failed center.

import React, { useMemo, useState } from 'react';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, AdminTable, KpiCard, Pill, Column } from '../primitives';
import { ActionLogEntry } from '../../../types';
import { fmtDateTime, tsToMillis } from '../util';

const statusTone = (s?: string) => s === 'success' ? 'green' : s === 'blocked' ? 'yellow' : s === 'failed_refunded' ? 'red' : 'gray';
const statusLabel = (s?: string) => s === 'failed_refunded' ? 'Failed' : s === 'blocked' ? 'Blocked' : s === 'success' ? 'Success' : 'Client';

const Analyses: React.FC = () => {
  const a = useAdmin();
  const [status, setStatus] = useState<'all' | 'success' | 'failed_refunded' | 'blocked'>('all');

  const analyses = a.actionLogs;
  const stats = useMemo(() => {
    const total = analyses.length;
    const success = analyses.filter(l => l.status === 'success').length;
    const failed = analyses.filter(l => l.status === 'failed_refunded').length;
    const blocked = analyses.filter(l => l.status === 'blocked').length;
    return { total, success, failed, blocked, successRate: total ? Math.round((success / total) * 100) : 0 };
  }, [analyses]);

  const rows = analyses.filter(l => status === 'all' || l.status === status);

  const columns: Column<ActionLogEntry>[] = [
    { key: 'time', header: 'Time', render: l => <span className="text-xs font-medium text-gray-600">{fmtDateTime(l.created_at || l.timestamp)}</span> },
    { key: 'user', header: 'User', render: l => <span className="text-xs font-bold text-[#0B0B0B] truncate block max-w-[160px]">{l.uid || l.user_id || 'Unknown'}</span> },
    { key: 'module', header: 'Tool', render: l => <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{l.module || '—'}</span> },
    { key: 'status', header: 'Status', render: l => <div><Pill tone={statusTone(l.status)}>{statusLabel(l.status)}</Pill>{l.error_code && <p className="text-[9px] text-red-500 mt-1 truncate max-w-[140px]">{l.error_code}</p>}</div> },
    { key: 'cost', header: 'Tokens', align: 'right', render: l => <span className="text-xs font-bold text-gray-600">{l.tokens_used ?? '—'}</span> },
  ];

  const failed = analyses.filter(l => l.status === 'failed_refunded').slice(0, 8);

  return (
    <div className="space-y-12">
      <AdminSectionHeader title="Analyses" subtitle="Execution ledger across all users, workspaces, agencies, and enterprises." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="Total (sampled)" value={stats.total} accent />
        <KpiCard label="Success Rate" value={`${stats.successRate}%`} tone={stats.successRate >= 90 ? 'good' : 'default'} />
        <KpiCard label="Failed" value={stats.failed} tone={stats.failed ? 'danger' : 'default'} />
        <KpiCard label="Blocked" value={stats.blocked} />
      </div>

      <AdminTable
        rows={rows}
        columns={columns}
        searchKeys={[l => l.module || '', l => l.uid || l.user_id || '', l => l.error_code || '']}
        searchPlaceholder="Search by tool, user, or error code…"
        empty="No analyses match."
        rightControls={
          <select value={status} onChange={e => setStatus(e.target.value as any)} className="bg-[#121212] border border-gray-800 rounded-xl px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-300 outline-none">
            <option value="all">All statuses</option><option value="success">Success</option><option value="failed_refunded">Failed</option><option value="blocked">Blocked</option>
          </select>
        }
      />

      {failed.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mb-4">Failed Analysis Center</p>
          <div className="space-y-3">{failed.map(l => (
            <div key={l.id} className="flex items-center justify-between p-4 bg-red-50/40 border border-red-100 rounded-xl">
              <div className="min-w-0"><p className="text-xs font-bold text-[#0B0B0B] truncate">{l.module || 'unknown'}</p><p className="text-[10px] font-mono text-red-500 truncate">{l.error_code || '—'}</p></div>
              <span className="text-[10px] text-gray-400 shrink-0">{fmtDateTime(l.created_at || l.timestamp)}</span>
            </div>
          ))}</div>
        </div>
      )}
    </div>
  );
};

export default Analyses;
