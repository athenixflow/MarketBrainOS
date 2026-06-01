// Team Workspace — Reports Center (Phase 6.1)
import React, { useEffect, useState } from 'react';
import { Card, EmptyState } from '../UI';
import { Workspace, Report } from '../../types';
import { getReportsForScope } from '../../services/persistenceService';

const TeamReports: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getReportsForScope('', { level: 'team', workspaceId: workspace.id }).then(setReports).finally(() => setLoading(false));
  }, [workspace.id]);

  if (loading) return <p className="text-gray-400 text-sm font-medium py-8">Loading reports…</p>;
  if (reports.length === 0) return <EmptyState message="No team reports yet." submessage="Reports saved to this workspace will be listed here." />;

  return (
    <Card title={`Reports (${reports.length})`}>
      <div className="space-y-3">
        {reports.map(r => (
          <div key={r.id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#0B0B0B] truncate">{r.title}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{r.report_type} · {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default TeamReports;
