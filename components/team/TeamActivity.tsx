// Team Workspace — Activity Feed (Phase 6.1)
import React, { useEffect, useState } from 'react';
import { Card, EmptyState, ErrorMessage, Skeleton } from '../UI';
import { Workspace, WorkspaceActivity } from '../../types';
import { getWorkspaceActivity } from '../../services/persistenceService';

const TYPE_COLORS: Record<string, string> = {
  workspace_created: 'bg-indigo-500', analysis_created: 'bg-blue-500', report_generated: 'bg-cyan-500',
  member_added: 'bg-green-500', member_removed: 'bg-red-500', role_changed: 'bg-purple-500',
  comment_added: 'bg-orange-500', settings_updated: 'bg-gray-500',
};

const TeamActivity: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
  const [items, setItems] = useState<WorkspaceActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getWorkspaceActivity(workspace.id, 100)
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { if (!cancelled) setError('We could not load the activity feed. Please try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workspace.id, reloadTick]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} tone="dark" className="h-14 w-full" />)}
      </div>
    );
  }
  if (error) return <ErrorMessage message={error} action={{ label: 'Retry', onClick: () => setReloadTick((t) => t + 1) }} />;
  if (items.length === 0) return <EmptyState card message="No activity yet" submessage="Workspace events appear here as your team works." />;

  return (
    <Card title="Activity Feed">
      <div className="space-y-4">
        {items.map(ev => (
          <div key={ev.id} className="flex items-start gap-3">
            <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${TYPE_COLORS[ev.type] || 'bg-gray-400'}`} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700">{ev.summary}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">
                {ev.actor_name || 'Someone'} · {ev.created_at ? new Date(ev.created_at).toLocaleString() : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default TeamActivity;
