// Platform Health — operational metrics rolled up from action_logs (success/fail/blocked, volume by
// module, top errors, recent issues), the 24h failure rate, and the auto-diagnostics suite.

import React, { useState } from 'react';
import { Card, PrimaryButton } from '../../UI';
import { useAdmin } from '../AdminContext';
import { KpiCard, AdminSectionHeader } from '../primitives';
import { BarChart, DonutChart } from '../Charts';
import { DiagnosisEngine } from '../../../services/diagnosisService';
import { DiagnosticResult } from '../../../types';
import { fmtDateTime } from '../util';

const PlatformHealth: React.FC = () => {
  const a = useAdmin();
  const m = a.metrics;
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const r = await DiagnosisEngine.runFullSuite();
    setTimeout(() => { setResults(r); setRunning(false); }, 600);
  };

  return (
    <div className="space-y-12">
      <AdminSectionHeader title="Platform Health" subtitle={`Operational health from the most recent ${m.sampleSize} system events.`} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="24h Failure Rate" value={`${a.failureRate.toFixed(1)}%`} tone={a.failureRate > 5 ? 'danger' : 'good'} hint={a.failureRate > 5 ? 'Degraded' : 'Healthy'} />
        <KpiCard label="Events Sampled" value={m.sampleSize} />
        <KpiCard label="Successful" value={m.statusCounts.success} tone="good" />
        <KpiCard label="Failed / Blocked" value={m.statusCounts.failed + m.statusCounts.blocked} tone={m.statusCounts.failed ? 'danger' : 'default'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Status Distribution">
          <DonutChart data={[
            { label: 'Success', value: m.statusCounts.success },
            { label: 'Failed', value: m.statusCounts.failed },
            { label: 'Blocked', value: m.statusCounts.blocked },
            { label: 'Other', value: m.statusCounts.other },
          ].filter(d => d.value > 0)} />
        </Card>
        <Card title="Volume by Module"><BarChart data={m.byModule.slice(0, 8).map(x => ({ label: x.module, value: x.count }))} /></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Top Error Codes">
          {m.topErrors.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center font-medium">No errors in window. ✓</p> : (
            <div className="space-y-3">{m.topErrors.map(e => (
              <div key={e.code} className="flex items-center justify-between">
                <span className="text-xs font-mono text-red-600 truncate">{e.code}</span>
                <span className="text-[10px] font-bold text-gray-400">{e.count}</span>
              </div>
            ))}</div>
          )}
        </Card>
        <Card title="Last Failure">
          <p className="text-xl font-bold text-[#0B0B0B]">{a.lastFailure || 'No recent failures'}</p>
          <p className="text-xs text-gray-400 mt-2">Most recent failed/refunded execution.</p>
        </Card>
      </div>

      <Card title="Recent Issues">
        {m.recentIssues.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center font-medium">No recent failures or blocks. ✓</p> : (
          <div className="space-y-3">{m.recentIssues.map(l => (
            <div key={l.id} className="flex items-start justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#0B0B0B] truncate">{l.module || l.action || 'unknown'}</p>
                <p className="text-[10px] text-gray-400 font-mono truncate">{l.error_code || '—'}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${l.status === 'blocked' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>{l.status === 'blocked' ? 'Blocked' : 'Failed'}</span>
                <p className="text-[10px] text-gray-400 mt-1">{fmtDateTime(l.created_at || l.timestamp)}</p>
              </div>
            </div>
          ))}</div>
        )}
      </Card>

      <Card title="Regression & Integrity Suite">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <p className="text-sm text-gray-500 font-medium max-w-xl">Automated verification of feature contracts, validation logic, and circuit-breaker health.</p>
          <PrimaryButton onClick={run} disabled={running}>{running ? 'Running…' : 'Run Auto-Diagnostics'}</PrimaryButton>
        </div>
        {results.length > 0 ? (
          <div className="space-y-3">{results.map(r => (
            <div key={r.id} className={`p-5 rounded-2xl border flex items-center justify-between ${r.status === 'PASS' ? 'bg-green-50 border-green-100' : r.status === 'WARN' ? 'bg-yellow-50 border-yellow-100' : 'bg-red-50 border-red-100'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${r.status === 'PASS' ? 'bg-green-500' : r.status === 'WARN' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                <div><p className="text-sm font-bold text-[#0B0B0B]">{r.name}</p><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{r.category}</p></div>
              </div>
              <span className={`text-[11px] font-black uppercase px-3 py-1 rounded-full ${r.status === 'PASS' ? 'text-green-600 bg-green-100' : r.status === 'WARN' ? 'text-yellow-600 bg-yellow-100' : 'text-red-600 bg-red-100'}`}>{r.status}</span>
            </div>
          ))}</div>
        ) : !running && <p className="text-sm text-gray-400 py-6 text-center font-medium">Run the suite to detect regressions.</p>}
      </Card>
    </div>
  );
};

export default PlatformHealth;
