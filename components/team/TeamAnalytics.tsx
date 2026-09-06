// Team Workspace — Analytics (Phase 6.1). Derived from shared analyses + members.
import React, { useEffect, useState } from 'react';
import { Card, Stat, EmptyState, ErrorMessage, Skeleton } from '../UI';
import { Workspace, WorkspaceMember } from '../../types';
import { getWorkspaceMembers, getAnalysesForScope, ToolAnalysisRecord } from '../../services/persistenceService';
import { getToolMeta } from '../../config/toolConfigs';

const TeamAnalytics: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [analyses, setAnalyses] = useState<ToolAnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getWorkspaceMembers(workspace.id),
      getAnalysesForScope('', { level: 'team', workspaceId: workspace.id }),
    ])
      .then(([mem, an]) => { if (cancelled) return; setMembers(mem); setAnalyses(an); })
      .catch(() => { if (!cancelled) setError('We could not load the team analytics. Please try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workspace.id, reloadTick]);

  const byTool = analyses.reduce<Record<string, number>>((a, r) => { a[r.module] = (a[r.module] || 0) + 1; return a; }, {});
  const byMember = analyses.reduce<Record<string, number>>((a, r: any) => { const k = r.creator_user_id || r.user_id || 'unknown'; a[k] = (a[k] || 0) + 1; return a; }, {});
  const topTools = Object.entries(byTool).sort((x, y) => y[1] - x[1]).slice(0, 8);
  const emailFor = (uid: string) => members.find(m => m.uid === uid)?.email || uid.slice(0, 8);
  const perMember = Object.entries(byMember).sort((x, y) => y[1] - x[1]);
  const avg = members.length ? (analyses.length / members.length).toFixed(1) : '0';

  if (loading) {
    return (
      <div className="space-y-10" aria-busy="true">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} tone="dark" className="h-28 w-full" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton tone="dark" className="h-64 w-full" />
          <Skeleton tone="dark" className="h-64 w-full" />
        </div>
      </div>
    );
  }
  if (error) return <ErrorMessage message={error} action={{ label: 'Retry', onClick: () => setReloadTick((t) => t + 1) }} />;

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card><Stat label="Total Analyses" value={analyses.length} /></Card>
        <Card><Stat label="Members" value={members.length} /></Card>
        <Card><Stat label="Avg / Member" value={avg} /></Card>
        <Card><Stat label="Tools Used" value={Object.keys(byTool).length} /></Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Most-used tools">
          {topTools.length === 0 ? <EmptyState message="No data yet" submessage="Shared analyses will show which tools your team uses most." /> : (
            <div className="space-y-2">{topTools.map(([m, c]) => (
              <div key={m} className="flex items-center justify-between gap-4"><span className="text-xs font-bold text-[#0B0B0B] truncate">{getToolMeta(m)?.label || m}</span><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">{c}</span></div>
            ))}</div>
          )}
        </Card>
        <Card title="Analyses per member">
          {perMember.length === 0 ? <EmptyState message="No data yet" submessage="Shared analyses will show who runs them." /> : (
            <div className="space-y-2">{perMember.map(([uid, c]) => (
              <div key={uid} className="flex items-center justify-between gap-4"><span className="text-xs font-medium text-gray-600 truncate">{emailFor(uid)}</span><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">{c}</span></div>
            ))}</div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default TeamAnalytics;
