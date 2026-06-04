// Workspace detail — info, owner, members, activity, and analysis/report/token stats (the latter
// derived from action_logs/reports scoped to this workspace).

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, KpiCard, Pill } from '../primitives';
import { getWorkspaceMembers, getWorkspaceActivity } from '../../../services/persistenceService';
import { WorkspaceMember, WorkspaceActivity } from '../../../types';
import { fmtDate, fmtDateTime } from '../util';

const WorkspaceDetail: React.FC = () => {
  const { id } = useParams();
  const a = useAdmin();
  const navigate = useNavigate();
  const ws: any = a.workspaces.find(w => w.id === id);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [activity, setActivity] = useState<WorkspaceActivity[]>([]);

  useEffect(() => {
    if (!id) return;
    getWorkspaceMembers(id).then(setMembers).catch(() => {});
    getWorkspaceActivity(id).then(setActivity).catch(() => {});
  }, [id]);

  const stats = useMemo(() => {
    const logs = a.actionLogs.filter(l => (l as any).workspace_id === id);
    const tokens = logs.reduce((n, l) => n + (l.tokens_used || 0), 0);
    const reports = a.reports.filter(r => r.workspace_id === id).length;
    return { analyses: logs.length, tokens, reports };
  }, [a.actionLogs, a.reports, id]);

  if (!ws) return (
    <div>
      <AdminSectionHeader title="Workspace" actions={<button onClick={() => navigate('/admin/workspaces')} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white">← Back</button>} />
      <Card><p className="text-gray-400 text-sm py-8 text-center font-medium">Workspace not found.</p></Card>
    </div>
  );

  return (
    <div className="space-y-10">
      <AdminSectionHeader title={ws.name || 'Workspace'} subtitle={`Owner ${ws.owner_id} • ${ws.status || 'active'}`}
        actions={<button onClick={() => navigate('/admin/workspaces')} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white">← Back to Workspaces</button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="Members" value={members.length || ws.member_count || 0} accent />
        <KpiCard label="Analyses" value={stats.analyses} />
        <KpiCard label="Reports" value={stats.reports} />
        <KpiCard label="Tokens Used" value={stats.tokens} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Workspace Info">
          {[['Name', ws.name], ['Owner', ws.owner_id], ['Status', ws.status || 'active'], ['Created', fmtDate(ws.created_at)], ['Workspace ID', ws.id]].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{k}</span><span className="text-sm font-bold text-[#0B0B0B] truncate max-w-[60%]">{v as string}</span></div>
          ))}
        </Card>
        <Card title={`Members (${members.length})`}>
          {members.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center font-medium">No members loaded.</p> : (
            <div className="divide-y divide-gray-50">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between py-3 first:pt-0">
                  <div className="min-w-0"><p className="text-sm font-bold text-[#0B0B0B] truncate">{m.email}</p><p className="text-[10px] text-gray-400">{fmtDate(m.joined_at)}</p></div>
                  <Pill tone={m.role === 'owner' ? 'red' : 'gray'}>{m.role}</Pill>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Activity Feed">
        {activity.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center font-medium">No activity recorded.</p> : (
          <div className="divide-y divide-gray-50">
            {activity.map(ev => (
              <div key={ev.id} className="flex items-center justify-between py-3 first:pt-0">
                <span className="text-xs font-medium text-gray-600">{ev.summary}</span>
                <span className="text-[10px] text-gray-400 shrink-0">{fmtDateTime(ev.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default WorkspaceDetail;
