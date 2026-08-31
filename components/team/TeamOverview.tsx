// Team Workspace — Overview panel (Phase 6.1)
import React, { useEffect, useState } from 'react';
import { Card } from '../UI';
import { Workspace, WorkspaceMember, WorkspaceActivity } from '../../types';
import { getWorkspaceMembers, getWorkspaceActivity, getAnalysesForScope, ToolAnalysisRecord } from '../../services/persistenceService';
import { getToolMeta } from '../../config/toolConfigs';

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <Card>
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{label}</p>
    <p className="text-2xl sm:text-3xl font-black text-[#0B0B0B] tabular-nums">{value}</p>
  </Card>
);

const TeamOverview: React.FC<{ workspace: Workspace; onQuickAction: (tab: string) => void }> = ({ workspace, onQuickAction }) => {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [activity, setActivity] = useState<WorkspaceActivity[]>([]);
  const [analyses, setAnalyses] = useState<ToolAnalysisRecord[]>([]);

  useEffect(() => {
    const wid = workspace.id;
    getWorkspaceMembers(wid).then(setMembers);
    getWorkspaceActivity(wid, 8).then(setActivity);
    getAnalysesForScope('', { level: 'team', workspaceId: wid }).then(setAnalyses);
  }, [workspace.id]);

  // Team intelligence: most-used tools + most-active members from shared analyses.
  const toolCounts = analyses.reduce<Record<string, number>>((acc, a) => {
    acc[a.module] = (acc[a.module] || 0) + 1; return acc;
  }, {});
  const topTools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Stat label="Members" value={members.length} />
        <Stat label="Shared Analyses" value={analyses.length} />
        <Stat label="Plan" value="Team" />
        <Stat label="Status" value={workspace.status === 'active' ? 'Active' : 'Archived'} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'New Analysis', tab: '__tools' },
          { label: 'Invite Member', tab: 'members' },
          { label: 'View Reports', tab: 'reports' },
          { label: 'Workspace Settings', tab: 'settings' },
        ].map(a => (
          <button
            key={a.tab}
            onClick={() => onQuickAction(a.tab)}
            className="px-5 py-3 rounded-xl bg-[#0B0B0B] text-white text-[11px] font-bold uppercase tracking-widest hover:bg-[#1a1a1a] transition-colors"
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Recent Team Activity">
          {activity.length === 0 ? (
            <p className="text-sm text-gray-400 font-medium py-6">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {activity.map(ev => (
                <div key={ev.id} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full mt-2 bg-[#FF0000] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700">{ev.summary}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {ev.actor_name || 'Someone'} · {ev.created_at ? new Date(ev.created_at).toLocaleString() : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Team Intelligence">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Most-used tools</p>
          {topTools.length === 0 ? (
            <p className="text-sm text-gray-400 font-medium">Run shared analyses to build team intelligence.</p>
          ) : (
            <div className="space-y-2 mb-6">
              {topTools.map(([mod, count]) => (
                <div key={mod} className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0B0B0B] truncate">{getToolMeta(mod)?.label || mod}</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{count}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Most-active members</p>
          <div className="space-y-2">
            {members.slice(0, 5).map(m => (
              <div key={m.id} className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600 truncate">{m.email}</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{m.role}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TeamOverview;
