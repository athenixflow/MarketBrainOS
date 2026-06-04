// Audit Log Center — the immutable, hash-chained ledger of every admin action, with KPIs, search,
// event-type filtering, before/after detail, and CSV export. Compliance tracking is a follow-up.

import React, { useMemo, useState } from 'react';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, KpiCard, ComingSoon } from '../primitives';
import { downloadAsCSV } from '../../../services/exportService';

const Audit: React.FC = () => {
  const a = useAdmin();
  const [q, setQ] = useState('');
  const [type, setType] = useState('All');

  const types = useMemo(() => ['All', ...Array.from(new Set(a.auditLogs.map(l => l.action_type))).sort()], [a.auditLogs]);
  const filtered = useMemo(() => a.auditLogs.filter(l => {
    const typeOk = type === 'All' || l.action_type === type;
    const n = q.trim().toLowerCase();
    const qOk = !n || (l.admin_email || '').toLowerCase().includes(n) || (l.target || '').toLowerCase().includes(n) || (l.action_type || '').toLowerCase().includes(n);
    return typeOk && qOk;
  }), [a.auditLogs, q, type]);

  const exportCsv = () => downloadAsCSV('MarketBrainOS_AuditLog', [
    ['Timestamp', 'Action', 'Actor', 'Target', 'Metadata', 'Hash'],
    ...a.auditLogs.map(l => [l.timestamp, l.action_type, l.admin_email, l.target, JSON.stringify(l.metadata || {}), l.hash]),
  ]);

  return (
    <div className="space-y-10">
      <AdminSectionHeader title="Audit Log Center" subtitle="Immutable, hash-chained record of every administrative action."
        actions={<div className="flex items-center gap-3">
          <button onClick={a.runManualIntegrityCheck} className="text-[10px] font-bold text-blue-500 hover:underline uppercase tracking-widest">{a.verifyingChain ? 'Verifying…' : 'Verify Chain'}</button>
          {a.auditLogs.length > 0 && <button onClick={exportCsv} className="px-5 py-2.5 rounded-xl bg-white/5 border border-gray-800 text-gray-300 text-[10px] font-bold uppercase tracking-widest hover:text-white">Export CSV</button>}
        </div>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="Total Audit Events" value={a.auditLogs.length} accent />
        <KpiCard label="Security Events" value={a.securityLogs.length} />
        <KpiCard label="Event Types" value={types.length - 1} />
        <KpiCard label="Chain" value={a.chainValid === false ? 'ERROR' : 'Valid'} tone={a.chainValid === false ? 'danger' : 'good'} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search actor, target, action…" className="bg-[#121212] border border-gray-800 rounded-xl px-5 py-3 text-sm text-white outline-none focus:border-[#FF0000]/40 w-full sm:w-80" />
        <select value={type} onChange={e => setType(e.target.value)} className="bg-[#121212] border border-gray-800 rounded-xl px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-300 outline-none">
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? <p className="text-sm text-gray-400 py-8 text-center font-medium italic">No audit events match.</p> : (
        <div className="space-y-4">
          {filtered.map(log => (
            <div key={log.id} className="p-6 bg-white border border-gray-100 rounded-[24px] flex flex-col gap-3">
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-[13px] font-black uppercase text-[#0B0B0B]">{log.action_type}</span></div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(log.timestamp).toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-8 text-[11px]">
                <div><p className="font-bold text-gray-400 uppercase tracking-widest mb-1">Actor</p><p className="font-bold text-[#0B0B0B] truncate">{log.admin_email}</p></div>
                <div><p className="font-bold text-gray-400 uppercase tracking-widest mb-1">Target</p><p className="font-bold text-[#0B0B0B] truncate">{log.target}</p></div>
              </div>
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <div className="pt-3 border-t border-gray-50">
                  <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2">Detail (before / after)</p>
                  <pre className="text-[9px] font-mono text-gray-500 bg-gray-50 p-2 rounded-lg overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
                </div>
              )}
              <code className="text-[9px] font-mono text-gray-400 break-all bg-gray-50 p-2 rounded-lg">{log.hash}</code>
            </div>
          ))}
        </div>
      )}

      <ComingSoon title="Compliance Center" description="Consent records, privacy/data-export requests, and account-deletion requests." />
    </div>
  );
};

export default Audit;
