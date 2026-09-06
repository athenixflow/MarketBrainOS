import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AnimatedSection from '../components/AnimatedSection';
import { PageHeader, Card, EmptyState, Skeleton, ErrorMessage, Input, Select, Badge } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { getAnalysesForScope, deleteAnalysisRecord, ToolAnalysisRecord } from '../services/persistenceService';
import { useScope } from '../context/ScopeContext';
import { getToolMeta } from '../config/toolConfigs';
import { getScoreBand } from '../services/scoreBands';
import { downloadAsCSV, toolResultToCSV, printToolResultPDF } from '../services/exportService';
import { ResultItemList } from '../components/ResultSections';

// The bespoke tools are not in TOOL_CONFIG_LIST, so getToolMeta cannot resolve their route.
const BESPOKE_SLUG: Record<string, string> = {
  angleminer_results: 'angle-miner',
  testlab_results: 'test-lab',
  conversion_doctor_results: 'conversion-doctor',
  workflow_runs: 'workflow',
};

const LOAD_ERROR = 'We could not load your history. Please try again.';
const rowAction = 'text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors';

const History: React.FC = () => {
  const { user } = useAuth();
  const { scope } = useScope();
  const [records, setRecords] = useState<ToolAnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [search, setSearch] = useState('');
  const [toolFilter, setToolFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string>('');

  // Unified history: results shown reflect the ACTIVE scope (personal vs a shared container).
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAnalysesForScope(user.uid, scope)
      .then((rows) => { if (!cancelled) setRecords(rows); })
      .catch((e) => { console.error(e); if (!cancelled) setError(LOAD_ERROR); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, scope, reloadTick]);

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

  // Routed by record source: bespoke rows live in their own collections, so deleting them via the
  // generic deleter would target the wrong collection and silently do nothing.
  const handleDelete = async (rec: ToolAnalysisRecord) => {
    await deleteAnalysisRecord(rec);
    setRecords((prev) => prev.filter((r) => r.id !== rec.id));
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analysis History"
        subtitle="Every analysis you run is saved here. Search, revisit, reopen, or remove past results."
      />

      {error && <ErrorMessage message={error} action={{ label: 'Retry', onClick: () => setReloadTick((t) => t + 1) }} />}

      {loading && (
        <div className="space-y-4" aria-busy="true">
          {[0, 1, 2].map((i) => <Skeleton key={i} tone="dark" className="h-32 w-full" />)}
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <EmptyState
          card
          message="No saved analyses yet"
          submessage="Run any analysis tool and it appears here automatically: searchable, exportable, and saved for good."
          action={
            <Link to="/" className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest hover:opacity-60 transition-opacity border-b border-[#FF0000]/20 pb-1">
              Run your first analysis →
            </Link>
          }
        />
      )}

      {!loading && records.length > 0 && (
        <>
          {/* Controls sit on the page background, so they use the dark field tone. */}
          <AnimatedSection index={0} className="flex flex-col sm:flex-row gap-3">
            <Input
              tone="dark"
              compact
              type="search"
              ariaLabel="Search analyses"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search analyses…"
              className="flex-grow"
            />
            <Select
              tone="dark"
              compact
              ariaLabel="Filter by tool"
              value={toolFilter}
              onChange={setToolFilter}
              options={[{ value: 'all', label: 'All tools' }, ...toolOptions.map(([mod, label]) => ({ value: mod, label }))]}
              className="sm:w-64"
            />
          </AnimatedSection>

          {filtered.length === 0 && (
            <EmptyState card message="No analyses match your filters" submessage="Try a different search term or clear the tool filter." />
          )}

          <div className="space-y-4">
            {filtered.map((rec) => {
              const meta = getToolMeta(rec.module);
              const label = meta?.label || rec.module;
              const slug = meta?.slug || (rec.source ? BESPOKE_SLUG[rec.source] : undefined);
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
                          return <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border tabular-nums ${b.bgClass} ${b.textClass}`}>{score} · {b.band}</span>;
                        })()}
                        {rec.result?.verdict && <Badge tone="dark">{rec.result.verdict}</Badge>}
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 tabular-nums">
                        {rec.timestamp ? new Date(rec.timestamp).toLocaleString() : 'Date unknown'}
                      </p>
                      {rec.result?.summary && (
                        <p className="text-sm text-gray-500 font-medium leading-relaxed line-clamp-2">{rec.result.summary}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-5 flex-wrap pt-5 mt-5 border-t border-gray-100">
                    <button onClick={() => setExpandedId(isOpen ? '' : rec.id)} aria-expanded={isOpen} className={rowAction}>
                      {isOpen ? 'Hide' : 'View'}
                    </button>
                    {slug && <Link to={`/${slug}`} className={rowAction}>Reopen tool</Link>}
                    {rec.result && (
                      <>
                        <button onClick={() => downloadAsCSV(`${label.replace(/\s+/g, '_')}_Report`, toolResultToCSV(rec.result))} className={rowAction}>
                          Export CSV
                        </button>
                        <button onClick={() => printToolResultPDF(`${label} Report`, rec.result)} className={rowAction}>
                          Export PDF
                        </button>
                      </>
                    )}
                    <button onClick={() => handleDelete(rec)} className="text-[10px] font-bold text-gray-400 hover:text-[#FF0000] uppercase tracking-widest transition-colors">Delete</button>
                  </div>

                  {isOpen && (
                    <div className="mt-6 space-y-6 animate-in fade-in duration-300">
                      {/* Without this, a record with no sections expanded to literally nothing. */}
                      {(rec.result?.sections || []).length === 0 && (
                        <p className="text-sm text-gray-400 font-medium">
                          {rec.result?.summary || 'This record has no saved detail sections.'}
                        </p>
                      )}
                      {(rec.result?.sections || []).map((section: any, si: number) => (
                        <div key={si}>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">{section.title}</p>
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
