// Team Workspace — Reports Center (Phase 6.1)
import React, { useEffect, useState } from 'react';
import { EmptyState, ErrorMessage, Skeleton } from '../UI';
import { Workspace, Report } from '../../types';
import { getReportsForScope } from '../../services/persistenceService';
import { ReportCard } from '../ReportCard';
import { useAuth } from '../../context/AuthContext';
import { useScope } from '../../context/ScopeContext';
import { canExport } from '../../config/access';

const TeamReports: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
  const { user, profile } = useAuth();
  const { memberships } = useScope();
  const exportsAllowed = canExport({ profile, memberships });
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
    <div className="space-y-6">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reports ({reports.length})</p>
      {reports.map((r) => (
        <ReportCard
          key={r.id}
          report={r}
          canExport={exportsAllowed}
          canDelete={!!user && r.creator_user_id === user.uid}
          onDeleted={(id) => setReports((rows) => rows.filter((x) => x.id !== id))}
        />
      ))}
    </div>
  );
};

export default TeamReports;
