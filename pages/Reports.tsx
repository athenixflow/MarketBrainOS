// Reports — unified reporting surface (Master Wiring: one reporting engine). Lists the saved
// reports visible in the user's ACTIVE scope (personal by default; team/client/enterprise when
// scoped via the ScopeSwitcher). Each report opens, exports and deletes through ReportCard - the
// cards used to be inert, so a saved report could never be read again.

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Report } from '../types';
import { useAuth } from '../context/AuthContext';
import { useScope } from '../context/ScopeContext';
import { getReportsForScope } from '../services/persistenceService';
import { PageHeader, EmptyState, Skeleton, ErrorMessage } from '../components/UI';
import { ReportCard } from '../components/ReportCard';
import { canExport } from '../config/access';

const LOAD_ERROR = 'We could not load your reports. Please try again.';

const Reports: React.FC = () => {
  const { user, profile } = useAuth();
  const { scope, memberships } = useScope();
  const exportsAllowed = canExport({ profile, memberships });
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    if (!user) return;
    setLoading(true);
    setError(null);
    getReportsForScope(user.uid, scope)
      .then(rows => { if (active) setReports(rows); })
      .catch((e) => { console.error(e); if (active) setError(LOAD_ERROR); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, scope, reloadTick]);

  const scopeLabel =
    scope.level === 'personal' ? 'Personal'
    : scope.level === 'team' ? 'Team Workspace'
    : scope.level === 'client' ? 'Client'
    : 'Enterprise';

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        subtitle={`Saved reports in your ${scopeLabel} scope. Save a report from any analysis result.`}
      />

      {error && <ErrorMessage message={error} action={{ label: 'Retry', onClick: () => setReloadTick((t) => t + 1) }} />}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} tone="dark" className="h-32 w-full" />)}
        </div>
      ) : !error && reports.length === 0 ? (
        <EmptyState
          card
          message="No reports yet"
          submessage="Run an analysis and use Save as report on the result to start building your reporting library."
          action={
            <Link to="/" className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest hover:opacity-60 transition-opacity border-b border-[#FF0000]/20 pb-1">
              Run your first analysis →
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      )}
    </div>
  );
};

export default Reports;
