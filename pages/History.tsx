import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AnimatedSection from '../components/AnimatedSection';
import { PageHeader, Card, EmptyState, LoadingState } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { getAnalysesForScope, deleteGenericAnalysis, ToolAnalysisRecord } from '../services/persistenceService';
import { useScope } from '../context/ScopeContext';
import { getToolMeta } from '../config/toolConfigs';
import { getScoreBand } from '../services/scoreBands';
import { downloadAsCSV, toolResultToCSV, printToolResultPDF } from '../services/exportService';
import { ResultItemList } from '../components/ResultSections';

const History: React.FC = () => {
  const { user } = useAuth();
  const { scope } = useScope();
  const [records, setRecords] = useState<ToolAnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toolFilter, setToolFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string>('');

  // Unified history: results shown reflect the ACTIVE scope (personal vs a shared container).
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    getAnalysesForScope(user.uid, scope)
      .then((rows) => { if (!cancelled) setRecords(rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, scope]);

  // Distinct tools present in history, for the filter dropdown.
  const toolOptions = useMemo(() => {
    const seen = new Map<string, string>();
    records.forEach((r) => seen.set(r.module, getToolMeta(r.module)?.label || r.module));
    return Array.from(seen.entries());
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (toolFilter !== 'all' && r.module !== toolFilter) return false;
      if (!q) return true;
      const hay = [
        getToolMeta(r.module)?.label || r.module,
        r.result?.summary || '',
        ...Object.values(r.inputs || {}),
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [records, search, toolFilter]);

  const handleDelete = async (id: string) => {
    await deleteGenericAnalysis(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-10">
      <PageHeader
        title="Analysis History"
        subtitle="Every analysis you run is saved here. Search, revisit, reopen, or remove past results."
      />

      {loading && <LoadingState message="Loading your history..." />}

      {!loading && records.length === 0 && (
        <EmptyState message="No saved analyses yet." submessage="Run any analysis tool and it will appear here automatically." />
      )}

      {!loading && records.length > 0 && (
        <>
          {/* Controls */}
          <AnimatedSection index={0} className="flex flex-col md:flex-row gap-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search analyses..."
              className="flex-grow bg-[#FBFBFB] border border-gray-100 p-4 rounded-2xl text-sm text-[#0B0B0B] outline-none focus:ring-4 focus:ring-[#FF0000]/5 focus:border-[#FF0000]/20 transition-all"
            />
            <select
              value={toolFilter}
              onChange={(e) => setToolFilter(e.target.value)}
              className="bg-[#FBFBFB] border border-gray-100 p-4 rounded-2xl text-sm text-[#0B0B0B] outline-none focus:ring-4 focus:ring-[#FF0000]/5 focus:border-[#FF0000]/20 transition-all"
            >
              <option value="all">All tools</option>
              {toolOptions.map(([mod, label]) => (
                <option key={mod} value={mod}>{label}</option>
              ))}
            </select>
          </AnimatedSection>

          {filtered.length === 0 && (
            <p className="text-gray-400 text-sm font-medium py-8 text-center">No analyses match your filters.</p>
          )}

          <div className="space-y-4">
            {filtered.map((rec) => {
              const meta = getToolMeta(rec.module);
              const label = meta?.label || rec.module;
              const isOpen = expandedId === rec.id;
              const score = typeof rec.result?.score === 'number' ? rec.result.score : undefined;
              return (
                <Card key={rec.id}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <h3 className="text-lg font-bold text-[#0B0B0B] tracking-tight">{label}</h3>
                        {typeof score === 'number' && (() => {
                          const b = getScoreBand(score);
                          return <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${b.bgClass} ${b.textClass}`}>{score} · {b.band}</span>;
                        })()}
                        {rec.result?.verdict && (
                          <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#0B0B0B] text-white">{rec.result.verdict}</span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                        {rec.timestamp ? new Date(rec.timestamp).toLocaleString() : '—'}
                      </p>
                      {rec.result?.summary && (
                        <p className="text-sm text-gray-500 font-medium leading-relaxed line-clamp-2">{rec.result.summary}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-5 flex-wrap pt-5 mt-5 border-t border-gray-50">
                    <button onClick={() => setExpandedId(isOpen ? '' : rec.id)} className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors">
                      {isOpen ? 'Hide' : 'View'}
                    </button>
                    {meta?.slug && (
                      <Link to={`/${meta.slug}`} className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors">Reopen Tool</Link>
                    )}
                    {rec.result && (
                      <>
                        <button
                          onClick={() => downloadAsCSV(`${label.replace(/\s+/g, '_')}_Report`, toolResultToCSV(rec.result))}
                          className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors"
                        >
                          Export CSV
                        </button>
                        <button
                          onClick={() => printToolResultPDF(`${label} Report`, rec.result)}
                          className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors"
                        >
                          Export PDF
                        </button>
                      </>
                    )}
                    <button onClick={() => handleDelete(rec.id)} className="text-[10px] font-bold text-gray-400 hover:text-[#FF0000] uppercase tracking-widest transition-colors">Delete</button>
                  </div>

                  {isOpen && (
                    <div className="mt-6 space-y-6 animate-in fade-in duration-300">
                      {(rec.result?.sections || []).map((section: any, si: number) => (
                        <div key={si}>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">{section.title}</p>
                          <ResultItemList items={section.items || []} compact />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default History;
