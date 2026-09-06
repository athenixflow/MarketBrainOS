// Team Workspace — Shared Analysis Library (Phase 6.1)
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, EmptyState, Input, Select, Skeleton, ErrorMessage } from '../UI';
import { Workspace } from '../../types';
import { getAnalysesForScope, ToolAnalysisRecord } from '../../services/persistenceService';
import { getToolMeta } from '../../config/toolConfigs';
import { getScoreBand } from '../../services/scoreBands';
import AnalysisComments from './AnalysisComments';
import { ResultItemList } from '../ResultSections';

const rowAction = 'text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors';

const SharedLibrary: React.FC<{ workspace: Workspace; selfUid: string; selfName: string }> = ({ workspace, selfUid, selfName }) => {
  const [records, setRecords] = useState<ToolAnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [search, setSearch] = useState('');
  const [toolFilter, setToolFilter] = useState('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [openId, setOpenId] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAnalysesForScope('', { level: 'team', workspaceId: workspace.id })
      .then((rows) => { if (!cancelled) setRecords(rows); })
      .catch((e) => { console.error(e); if (!cancelled) setError('We could not load the shared library. Please try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workspace.id, reloadTick]);

  const toolOptions = useMemo(() => {
    const seen = new Map<string, string>();
    records.forEach(r => seen.set(r.module, getToolMeta(r.module)?.label || r.module));
    return Array.from(seen.entries());
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = records.filter(r => {
      if (toolFilter !== 'all' && r.module !== toolFilter) return false;
      if (!q) return true;
      return [getToolMeta(r.module)?.label || r.module, r.result?.summary || '', ...Object.values(r.inputs || {})]
        .join(' ').toLowerCase().includes(q);
    });
    rows = rows.sort((a, b) => {
      const d = new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
      return sort === 'newest' ? d : -d;
    });
    return rows;
  }, [records, search, toolFilter, sort]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        {[0, 1, 2].map((i) => <Skeleton key={i} tone="dark" className="h-28 w-full" />)}
      </div>
    );
  }
  if (error) return <ErrorMessage message={error} action={{ label: 'Retry', onClick: () => setReloadTick((t) => t + 1) }} />;
  if (records.length === 0) {
    return <EmptyState card message="No shared analyses yet" submessage="Run a tool in this workspace with Shared with team selected and it appears here for everyone." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input tone="dark" compact type="search" ariaLabel="Search shared analyses" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shared analyses…" className="flex-grow" />
        <Select tone="dark" compact ariaLabel="Filter by tool" value={toolFilter} onChange={setToolFilter}
          options={[{ value: 'all', label: 'All tools' }, ...toolOptions.map(([m, l]) => ({ value: m, label: l }))]} className="sm:w-56" />
        <Select tone="dark" compact ariaLabel="Sort" value={sort} onChange={(v) => setSort(v as 'newest' | 'oldest')}
          options={[{ value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }]} className="sm:w-40" />
      </div>

      {filtered.length === 0 && (
        <EmptyState card message="No shared analyses match your filters" submessage="Try a different search term or clear the tool filter." />
      )}

      <div className="space-y-4">
        {filtered.map(rec => {
          const meta = getToolMeta(rec.module);
          const label = meta?.label || rec.module;
          const isOpen = openId === rec.id;
          const score = typeof rec.result?.score === 'number' ? rec.result.score : undefined;
          return (
            <Card key={rec.id}>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h3 className="text-lg font-bold text-[#0B0B0B] tracking-tight">{label}</h3>
                {typeof score === 'number' && (() => { const b = getScoreBand(score); return <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border tabular-nums ${b.bgClass} ${b.textClass}`}>{score} · {b.band}</span>; })()}
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 tabular-nums">{rec.timestamp ? new Date(rec.timestamp).toLocaleString() : 'Date unknown'}</p>
              {rec.result?.summary && <p className="text-sm text-gray-500 font-medium leading-relaxed line-clamp-2">{rec.result.summary}</p>}

              <div className="flex items-center gap-5 flex-wrap pt-4 mt-4 border-t border-gray-100">
                <button onClick={() => setOpenId(isOpen ? '' : rec.id)} aria-expanded={isOpen} className={rowAction}>{isOpen ? 'Hide' : 'View and discuss'}</button>
                {meta?.slug && <Link to={`/${meta.slug}`} className={rowAction}>Open tool</Link>}
              </div>

              {isOpen && (
                <div className="mt-6 space-y-6 animate-in fade-in duration-300">
                  {(rec.result?.sections || []).length === 0 && (
                    <p className="text-sm text-gray-400 font-medium">{rec.result?.summary || 'This record has no saved detail sections.'}</p>
                  )}
                  {(rec.result?.sections || []).map((s: any, i: number) => (
                    <div key={i}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">{s.title}</p>
                      <ResultItemList items={s.items || []} compact />
                    </div>
                  ))}
                  <AnalysisComments workspaceId={workspace.id} analysisId={rec.id} selfUid={selfUid} selfName={selfName} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SharedLibrary;
