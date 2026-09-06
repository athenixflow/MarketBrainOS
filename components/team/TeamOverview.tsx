// Team Workspace — Overview panel (Phase 6.1)
import React, { useEffect, useState } from 'react';
import { Card, Stat, SecondaryButton, EmptyState, ErrorMessage, Skeleton, Badge } from '../UI';
import { Workspace, WorkspaceMember, WorkspaceActivity } from '../../types';
import { getWorkspaceMembers, getWorkspaceActivity, getAnalysesForScope, ToolAnalysisRecord } from '../../services/persistenceService';
import { getToolMeta } from '../../config/toolConfigs';
import { ROLE_LABELS } from '../../services/permissionService';

const roleTone = (role: string): 'red' | 'blue' | 'neutral' =>
  role === 'owner' ? 'red' : role === 'admin' ? 'blue' : 'neutral';

const QUICK_ACTIONS = [
  { label: 'New Analysis', tab: '__tools' },
  { label: 'Invite Member', tab: 'members' },
  { label: 'View Reports', tab: 'reports' },
  { label: 'Workspace Settings', tab: 'settings' },
];

const TeamOverview: React.FC<{ workspace: Workspace; onQuickAction: (tab: string) => void }> = ({ workspace, onQuickAction }) => {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [activity, setActivity] = useState<WorkspaceActivity[]>([]);
  const [analyses, setAnalyses] = useState<ToolAnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const wid = workspace.id;
    setLoading(true);
    setError(null);
    Promise.all([
      getWorkspaceMembers(wid),
      getWorkspaceActivity(wid, 8),
      getAnalysesForScope('', { level: 'team', workspaceId: wid }),
    ])
      .then(([mem, act, an]) => { if (cancelled) return; setMembers(mem); setActivity(act); setAnalyses(an); })
      .catch(() => { if (!cancelled) setError('We could not load the workspace overview. Please try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workspace.id, reloadTick]);

  // Team intelligence: most-used tools + most-active members from shared analyses.
  const toolCounts = analyses.reduce<Record<string, number>>((acc, a) => {
    acc[a.module] = (acc[a.module] || 0) + 1; return acc;
  }, {});
  const topTools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

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
        <Card><Stat label="Members" value={members.length} /></Card>
        <Card><Stat label="Shared Analyses" value={analyses.length} /></Card>
        <Card><Stat label="Plan" value="Team" /></Card>
        <Card><Stat label="Status" value={workspace.status === 'active' ? 'Active' : 'Archived'} /></Card>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-3">
        {QUICK_ACTIONS.map(a => (
          <SecondaryButton key={a.tab} tone="dark" size="sm" onClick={() => onQuickAction(a.tab)}>{a.label}</SecondaryButton>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Recent Team Activity">
          {activity.length === 0 ? (
            <EmptyState message="No activity yet" submessage="Workspace events appear here as your team works." />
          ) : (
            <div className="space-y-3">
              {activity.map(ev => (
                <div key={ev.id} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full mt-2 bg-[#FF0000] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700">{ev.summary}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">
                      {ev.actor_name || 'Someone'} · {ev.created_at ? new Date(ev.created_at).toLocaleString() : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Team Intelligence">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Most-used tools</p>
          {topTools.length === 0 ? (
            <p className="text-sm text-gray-400 font-medium mb-6">Run shared analyses to build team intelligence.</p>
          ) : (
            <div className="space-y-2 mb-6">
              {topTools.map(([mod, count]) => (
                <div key={mod} className="flex items-center justify-between gap-4">
                  <span className="text-xs font-bold text-[#0B0B0B] truncate">{getToolMeta(mod)?.label || mod}</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Most-active members</p>
          <div className="space-y-2">
            {members.slice(0, 5).map(m => (
              <div key={m.id} className="flex items-center justify-between gap-4">
                <span className="text-xs font-medium text-gray-600 truncate">{m.email}</span>
                <Badge tone={roleTone(m.role)}>{ROLE_LABELS[m.role] || m.role}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TeamOverview;
