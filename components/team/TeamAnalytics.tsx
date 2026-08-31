// Team Workspace — Analytics (Phase 6.1). Derived from shared analyses + members.
import React, { useEffect, useState } from 'react';
import { Card } from '../UI';
import { Workspace, WorkspaceMember } from '../../types';
import { getWorkspaceMembers, getAnalysesForScope, ToolAnalysisRecord } from '../../services/persistenceService';
import { getToolMeta } from '../../config/toolConfigs';

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <Card><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{label}</p><p className="text-2xl sm:text-3xl font-black text-[#0B0B0B] tabular-nums">{value}</p></Card>
);

const TeamAnalytics: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [analyses, setAnalyses] = useState<ToolAnalysisRecord[]>([]);

  useEffect(() => {
    getWorkspaceMembers(workspace.id).then(setMembers);
    getAnalysesForScope('', { level: 'team', workspaceId: workspace.id }).then(setAnalyses);
  }, [workspace.id]);

  const byTool = analyses.reduce<Record<string, number>>((a, r) => { a[r.module] = (a[r.module] || 0) + 1; return a; }, {});
  const byMember = analyses.reduce<Record<string, number>>((a, r: any) => { const k = r.creator_user_id || r.user_id || 'unknown'; a[k] = (a[k] || 0) + 1; return a; }, {});
  const topTools = Object.entries(byTool).sort((x, y) => y[1] - x[1]).slice(0, 8);
  const emailFor = (uid: string) => members.find(m => m.uid === uid)?.email || uid.slice(0, 8);
  const perMember = Object.entries(byMember).sort((x, y) => y[1] - x[1]);
  const avg = members.length ? (analyses.length / members.length).toFixed(1) : '0';

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Stat label="Total Analyses" value={analyses.length} />
        <Stat label="Members" value={members.length} />
        <Stat label="Avg / Member" value={avg} />
        <Stat label="Tools Used" value={Object.keys(byTool).length} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Most-used tools">
          {topTools.length === 0 ? <p className="text-sm text-gray-400 font-medium">No data yet.</p> : (
            <div className="space-y-2">{topTools.map(([m, c]) => (
              <div key={m} className="flex items-center justify-between"><span className="text-xs font-bold text-[#0B0B0B] truncate">{getToolMeta(m)?.label || m}</span><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{c}</span></div>
            ))}</div>
          )}
        </Card>
        <Card title="Analyses per member">
          {perMember.length === 0 ? <p className="text-sm text-gray-400 font-medium">No data yet.</p> : (
            <div className="space-y-2">{perMember.map(([uid, c]) => (
              <div key={uid} className="flex items-center justify-between"><span className="text-xs font-medium text-gray-600 truncate">{emailFor(uid)}</span><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{c}</span></div>
            ))}</div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default TeamAnalytics;
