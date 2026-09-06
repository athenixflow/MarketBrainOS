// Team Workspace — Reports Center (Phase 6.1)
import React, { useEffect, useState } from 'react';
import { Card, EmptyState, ErrorMessage, Skeleton, Badge } from '../UI';
import { Workspace, Report } from '../../types';
import { getReportsForScope } from '../../services/persistenceService';

const TeamReports: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getReportsForScope('', { level: 'team', workspaceId: workspace.id })
      .then((rows) => { if (!cancelled) setReports(rows); })
      .catch(() => { if (!cancelled) setError('We could not load the team reports. Please try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workspace.id, reloadTick]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        {[0, 1, 2].map((i) => <Skeleton key={i} tone="dark" className="h-20 w-full" />)}
      </div>
    );
  }
  if (error) return <ErrorMessage message={error} action={{ label: 'Retry', onClick: () => setReloadTick((t) => t + 1) }} />;
  if (reports.length === 0) return <EmptyState card message="No team reports yet" submessage="Reports saved to this workspace will be listed here." />;

  return (
    <Card title={`Reports (${reports.length})`}>
      <div className="space-y-3">
        {reports.map(r => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#0B0B0B] truncate">{r.title}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums mt-1">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</p>
            </div>
            <Badge tone="neutral">{r.report_type}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default TeamReports;
