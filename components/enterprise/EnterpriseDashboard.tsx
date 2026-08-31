// Enterprise Suite — Dashboard panel (Phase 6.3)
import React from 'react';
import { Card, PrimaryButton } from '../UI';
import { Enterprise, EnterpriseHealthScore, EnterpriseAnalyticsSnapshot } from '../../types';

const BAND_COLOR: Record<string, string> = {
  critical: 'text-red-600', weak: 'text-orange-500', stable: 'text-yellow-500', strong: 'text-blue-500', excellent: 'text-green-600',
};
const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <Card><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{label}</p><p className="text-2xl sm:text-3xl font-black text-[#0B0B0B] tabular-nums">{value}</p></Card>
);

const EnterpriseDashboard: React.FC<{
  enterprise: Enterprise; health: EnterpriseHealthScore | null; analytics: EnterpriseAnalyticsSnapshot | null;
  memberCount: number; onRefresh: () => void; refreshing: boolean; onQuickAction: (tab: string) => void;
}> = ({ enterprise, health, analytics, memberCount, onRefresh, refreshing, onQuickAction }) => (
  <div className="space-y-10">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <Card className="lg:col-span-1 flex flex-col items-center justify-center text-center">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Enterprise Health</p>
        {health ? (
          <>
            <p className={`text-6xl font-black ${BAND_COLOR[health.band] || 'text-[#0B0B0B]'}`}>{health.score}</p>
            <p className={`text-xs font-black uppercase tracking-widest mt-2 ${BAND_COLOR[health.band] || 'text-gray-500'}`}>{health.band}</p>
            <p className="text-[9px] text-gray-400 mt-3">Updated {new Date(health.computed_at).toLocaleDateString()}</p>
          </>
        ) : (
          <>
            <p className="text-4xl font-black text-gray-200">—</p>
            <p className="text-xs text-gray-400 font-medium mt-3">No health score yet. Run aggregation to compute.</p>
          </>
        )}
      </Card>
      <div className="lg:col-span-2 grid grid-cols-2 gap-6">
        <Stat label="Members" value={memberCount} />
        <Stat label="Departments" value={enterprise.department_count || 0} />
        <Stat label="Brands" value={enterprise.brand_count || 0} />
        <Stat label="Linked Teams" value={(enterprise.linked_workspaces || []).length} />
        <Stat label="Total Analyses" value={analytics?.total_analyses ?? '—'} />
        <Stat label="Active Users" value={analytics?.active_users ?? '—'} />
      </div>
    </div>

    {health && (
      <Card title="Health signals">
        {(health.signals || []).length === 0 && (
          <p className="text-sm text-gray-400 font-medium">No health signals were produced for this period.</p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(health.signals || []).map(s => (
            <div key={s.label} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
              <p className="text-2xl font-black text-[#0B0B0B] mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      </Card>
    )}

    <div className="flex flex-wrap gap-3 items-center">
      <PrimaryButton onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Aggregating…' : 'Refresh Analytics'}</PrimaryButton>
      {['Intelligence', 'Briefings', 'Structure'].map(t => (
        <button key={t} onClick={() => onQuickAction(t)} className="px-5 py-3 rounded-xl bg-[#0B0B0B] text-white text-[11px] font-bold uppercase tracking-widest hover:bg-[#1a1a1a] transition-colors">{t}</button>
      ))}
      <span className="text-[10px] text-gray-400 font-medium">The analytics engine runs server-side (deploy-time).</span>
    </div>
  </div>
);

export default EnterpriseDashboard;
