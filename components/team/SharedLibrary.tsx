// Team Workspace — Shared Analysis Library (Phase 6.1)
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, EmptyState } from '../UI';
import { Workspace } from '../../types';
import { getAnalysesForScope, ToolAnalysisRecord } from '../../services/persistenceService';
import { getToolMeta } from '../../config/toolConfigs';
import { getScoreBand } from '../../services/scoreBands';
import AnalysisComments from './AnalysisComments';

const SharedLibrary: React.FC<{ workspace: Workspace; selfUid: string; selfName: string }> = ({ workspace, selfUid, selfName }) => {
  const [records, setRecords] = useState<ToolAnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toolFilter, setToolFilter] = useState('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [openId, setOpenId] = useState('');

  useEffect(() => {
    setLoading(true);
    getAnalysesForScope('', { level: 'team', workspaceId: workspace.id })
      .then(setRecords).finally(() => setLoading(false));
  }, [workspace.id]);

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

  if (loading) return <p className="text-gray-400 text-sm font-medium py-8">Loading shared analyses…</p>;
  if (records.length === 0) return <EmptyState message="No shared analyses yet." submessage="Run a tool in this workspace (Workspace visibility) and it appears here for the team." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shared analyses…"
          className="flex-grow bg-[#FBFBFB] border border-gray-100 p-4 rounded-2xl text-sm outline-none" />
        <select value={toolFilter} onChange={(e) => setToolFilter(e.target.value)} className="bg-[#FBFBFB] border border-gray-100 p-4 rounded-2xl text-sm outline-none">
          <option value="all">All tools</option>
          {toolOptions.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="bg-[#FBFBFB] border border-gray-100 p-4 rounded-2xl text-sm outline-none">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>

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
                {typeof score === 'number' && (() => { const b = getScoreBand(score); return <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${b.bgClass} ${b.textClass}`}>{score} · {b.band}</span>; })()}
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{rec.timestamp ? new Date(rec.timestamp).toLocaleString() : '—'}</p>
              {rec.result?.summary && <p className="text-sm text-gray-500 font-medium leading-relaxed line-clamp-2">{rec.result.summary}</p>}

              <div className="flex items-center gap-5 flex-wrap pt-4 mt-4 border-t border-gray-50">
                <button onClick={() => setOpenId(isOpen ? '' : rec.id)} className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors">{isOpen ? 'Hide' : 'View & Discuss'}</button>
                {meta?.slug && <Link to={`/${meta.slug}`} className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors">Open Tool</Link>}
              </div>

              {isOpen && (
                <div className="mt-6 space-y-6 animate-in fade-in duration-300">
                  {(rec.result?.sections || []).map((s: any, i: number) => (
                    <div key={i}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{s.title}</p>
                      <div className="space-y-2">
                        {(s.items || []).map((item: string, j: number) => (
                          <div key={j} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="w-1.5 h-1.5 rounded-full mt-2 bg-[#FF0000]" />
                            <p className="text-sm text-gray-600 leading-relaxed font-medium flex-1">{item}</p>
                          </div>
                        ))}
                      </div>
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
