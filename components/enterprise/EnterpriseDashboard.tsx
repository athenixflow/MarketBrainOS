// Enterprise Suite — Dashboard panel (Phase 6.3)
import React from 'react';
import { Card, Stat, PrimaryButton, SecondaryButton, EmptyState } from '../UI';
import { Enterprise, EnterpriseHealthScore, EnterpriseAnalyticsSnapshot } from '../../types';

const BAND_COLOR: Record<string, string> = {
  critical: 'text-red-600', weak: 'text-orange-500', stable: 'text-yellow-500', strong: 'text-blue-500', excellent: 'text-green-600',
};

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
            <p className={`text-6xl font-black tabular-nums leading-none ${BAND_COLOR[health.band] || 'text-[#0B0B0B]'}`}>{health.score}</p>
            <p className={`text-xs font-bold uppercase tracking-widest mt-3 ${BAND_COLOR[health.band] || 'text-gray-500'}`}>{health.band}</p>
            <p className="text-[10px] text-gray-400 mt-3 tabular-nums">Updated {new Date(health.computed_at).toLocaleDateString()}</p>
          </>
        ) : (
          <>
            <p className="text-4xl font-black text-gray-200">—</p>
            <p className="text-xs text-gray-400 font-medium mt-3">No health score yet. Refresh analytics to compute one.</p>
          </>
        )}
      </Card>
      {/* Six tiles inside a two-thirds column: three across at lg keeps two clean rows. */}
      <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card><Stat label="Members" value={memberCount} /></Card>
        <Card><Stat label="Departments" value={enterprise.department_count || 0} /></Card>
        <Card><Stat label="Brands" value={enterprise.brand_count || 0} /></Card>
        <Card><Stat label="Linked Teams" value={(enterprise.linked_workspaces || []).length} /></Card>
        <Card><Stat label="Total Analyses" value={analytics?.total_analyses ?? '—'} /></Card>
        <Card><Stat label="Active Users" value={analytics?.active_users ?? '—'} /></Card>
      </div>
    </div>

    {health && (
      <Card title="Health signals">
        {(health.signals || []).length === 0 ? (
          <EmptyState message="No health signals for this period" submessage="Signals appear after the next analytics refresh." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(health.signals || []).map(s => (
              <div key={s.label} className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <Stat label={s.label} value={s.value} />
              </div>
            ))}
          </div>
        )}
      </Card>
    )}

    <div>
      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Aggregating…' : 'Refresh Analytics'}</PrimaryButton>
        {['Intelligence', 'Briefings', 'Structure'].map(t => (
          <SecondaryButton key={t} tone="dark" onClick={() => onQuickAction(t)}>{t}</SecondaryButton>
        ))}
      </div>
      <p className="mt-4 text-xs text-gray-500">Refreshing recalculates health and analytics across every linked team and agency. This can take a moment.</p>
    </div>
  </div>
);

export default EnterpriseDashboard;
