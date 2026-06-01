import React, { useState, useEffect, useMemo } from 'react';
import AnimatedSection from './AnimatedSection';
import {
  PageHeader,
  Card,
  Input,
  PrimaryButton,
  IntelligenceIndicator,
  EmptyState,
  LoadingState,
  ErrorMessage,
  AnalysisFailureState,
  ExportControls,
  HoneypotField,
  UsageLimitModal,
} from './UI';
import { runToolAnalysis, MAX_INPUT_CHARS } from '../services/geminiService';
import { ToolAnalysisResult, TOKEN_COSTS } from '../types';
import { useAuth } from '../context/AuthContext';
import { useScope } from '../context/ScopeContext';
import { copyToClipboard, downloadAsText, printToolResultPDF, formatToolResult, downloadAsCSV, toolResultToCSV } from '../services/exportService';
import { SecurityEngine } from '../services/securityEngine';
import { ToolConfig, getToolMeta } from '../config/toolConfigs';
import { getUserToolAnalyses, ToolAnalysisRecord, deleteGenericAnalysis } from '../services/persistenceService';
import { getScoreBand } from '../services/scoreBands';

const ToolPage: React.FC<{ config: ToolConfig }> = ({ config }) => {
  const { user, profile, refreshProfile } = useAuth();
  const { scope } = useScope();

  const initialValues = useMemo(() => {
    const v: Record<string, string> = {};
    config.inputs.forEach(f => { v[f.key] = f.options ? f.options[0] : ''; });
    return v;
  }, [config]);

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [honeypotValue, setHoneypotValue] = useState('');

  const [loading, setLoading] = useState(false);
  const [isTakingLong, setIsTakingLong] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [result, setResult] = useState<ToolAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');

  const [showUsageModal, setShowUsageModal] = useState(false);
  const [usageReason, setUsageReason] = useState<'exhausted' | 'insufficient'>('exhausted');

  // Connected-ecosystem context: prior analyses from related tools (config.worksWith).
  const [priorAnalyses, setPriorAnalyses] = useState<ToolAnalysisRecord[]>([]);
  const [selectedContextId, setSelectedContextId] = useState<string>('');

  // Result-action feedback (Share copied / Deleted).
  const [actionMsg, setActionMsg] = useState<string>('');
  const [deleted, setDeleted] = useState(false);

  const cost = TOKEN_COSTS[config.costKey];
  const primaryField = config.inputs.find(f => f.primary) || config.inputs.find(f => f.multiline) || config.inputs[0];

  // Reset state when switching between tools (shared component instance).
  useEffect(() => {
    setValues(initialValues);
    setResult(null);
    setError(null);
    setExecutionError(null);
    setHoneypotValue('');
    setActiveTab('');
    setSelectedContextId('');
  }, [config, initialValues]);

  // Load prior analyses from related tools to offer as injectable context.
  useEffect(() => {
    setPriorAnalyses([]);
    if (!user || !config.worksWith || config.worksWith.length === 0) return;
    let cancelled = false;
    getUserToolAnalyses(user.uid).then((rows) => {
      if (cancelled) return;
      setPriorAnalyses(rows.filter((r) => config.worksWith.includes(r.module)));
    });
    return () => { cancelled = true; };
  }, [config, user]);

  useEffect(() => {
    let timer: number;
    if (loading) {
      timer = window.setTimeout(() => setIsTakingLong(true), 8000);
    } else {
      setIsTakingLong(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const setField = (key: string, val: string) => setValues(prev => ({ ...prev, [key]: val }));

  const checkTokenAvailability = (): boolean => {
    if (!profile) return false;
    if (profile.tokens === 0) {
      setUsageReason('exhausted');
      setShowUsageModal(true);
      return false;
    }
    if (profile.tier === 'free' && profile.tokens < cost) {
      setUsageReason('insufficient');
      setShowUsageModal(true);
      return false;
    }
    return true;
  };

  const handleRun = async () => {
    if (honeypotValue) {
      await SecurityEngine.handleHoneypotTrigger(profile);
      setError('Security violation detected.');
      return;
    }

    const primaryValue = primaryField ? (values[primaryField.key] || '') : '';
    if (primaryValue.trim().length < 20) {
      setError('Add more detail to the main input for a high-quality analysis.');
      return;
    }
    if (primaryValue.length > MAX_INPUT_CHARS) {
      setError(`Input is too long (${primaryValue.length}/${MAX_INPUT_CHARS}). Please consolidate.`);
      return;
    }

    if (!checkTokenAvailability()) return;

    if (profile && profile.is_suspended) {
      setError('Account operations suspended.');
      return;
    }

    // Build connected-ecosystem context from a selected prior analysis.
    let contextText: string | undefined;
    const selected = priorAnalyses.find((a) => a.id === selectedContextId);
    if (selected) {
      const label = getToolMeta(selected.module)?.label || selected.module;
      const highlights = (selected.result?.sections || [])
        .slice(0, 2)
        .flatMap((s: any) => (s.items || []).slice(0, 3))
        .join('; ');
      contextText = `${label} analysis — ${selected.result?.summary || ''}${highlights ? ' Highlights: ' + highlights : ''}`.trim();
    }

    setLoading(true);
    setError(null);
    setExecutionError(null);
    setResult(null);
    setActionMsg('');
    setDeleted(false);
    try {
      // Stamp the active scope so the result lands in the right container (personal → private).
      const data = await runToolAnalysis(config.module, values, user?.uid, contextText, scope);
      setResult(data);
      setActiveTab(data.sections[0]?.title || '');
      if (user) await refreshProfile();
    } catch (err: any) {
      console.error(err);
      setExecutionError(err.message || 'The neural engine encountered an unexpected interruption. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const exportText = () => (result ? formatToolResult(config.title, result) : '');
  const fileBase = `${config.title.replace(/\s+/g, '_')}_Report`;
  const handleCopy = () => copyToClipboard(exportText());
  const handleExportTxt = () => downloadAsText(fileBase, exportText());
  const handleExportCSV = () => { if (result) downloadAsCSV(fileBase, toolResultToCSV(result)); };
  const handleExportPDF = () => { if (result) printToolResultPDF(`${config.title} Report`, result); };

  // Result actions (Save is automatic on success; Export handled above).
  const handleShare = async () => {
    await copyToClipboard(exportText());
    setActionMsg('Result copied to clipboard');
    setTimeout(() => setActionMsg(''), 2500);
  };
  const handleDelete = async () => {
    if (result?.savedId) {
      try { await deleteGenericAnalysis(result.savedId); } catch (e) { console.error(e); }
    }
    setDeleted(true);
    setResult(null);
    setActionMsg('');
  };

  const activeSection = result?.sections.find(s => s.title === activeTab) || result?.sections[0];

  return (
    <div className="space-y-10">
      <PageHeader title={config.title} subtitle={config.subtitle} />

      <div className="grid lg:grid-cols-2 gap-10">
        {/* INPUT PANEL */}
        <AnimatedSection index={0}>
          <Card>
            <div className="space-y-2">
              {config.inputs.map(field => (
                field.options ? (
                  <div key={field.key} className="mb-12">
                    <label className="block text-xs font-bold text-[#0B0B0B] mb-5 tracking-widest uppercase opacity-40">{field.label}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {field.options.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setField(field.key, opt)}
                          className={`px-4 py-3 rounded-xl text-xs font-bold transition-all ${values[field.key] === opt ? 'bg-[#0B0B0B] text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Input
                    key={field.key}
                    label={field.label}
                    placeholder={field.placeholder}
                    value={values[field.key] || ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    multiline={field.multiline}
                  />
                )
              ))}

              {priorAnalyses.length > 0 && (
                <div className="mb-12">
                  <label className="block text-xs font-bold text-[#0B0B0B] mb-5 tracking-widest uppercase opacity-40">
                    Add context from a prior analysis (optional)
                  </label>
                  <select
                    value={selectedContextId}
                    onChange={(e) => setSelectedContextId(e.target.value)}
                    className="w-full bg-[#FBFBFB] border border-gray-100 p-5 rounded-2xl text-sm text-[#0B0B0B] outline-none focus:ring-4 focus:ring-[#FF0000]/5 focus:border-[#FF0000]/20 transition-all"
                  >
                    <option value="">None</option>
                    {priorAnalyses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {(getToolMeta(a.module)?.label || a.module)} — {new Date(a.timestamp).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                  <p className="mt-3 text-[10px] font-medium text-gray-400 leading-relaxed">
                    Feeds a related saved analysis into this tool for connected intelligence.
                  </p>
                </div>
              )}

              <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />

              {error && <div className="mb-8"><ErrorMessage message={error} /></div>}

              <PrimaryButton onClick={handleRun} disabled={loading} className="w-full">
                {loading ? 'Analyzing...' : `${config.ctaVerb} (${cost} Tokens)`}
              </PrimaryButton>
            </div>
          </Card>
        </AnimatedSection>

        {/* RESULT PANEL */}
        <div className="space-y-6">
          {executionError && <AnalysisFailureState message={executionError} onRetry={handleRun} />}
          {loading && <LoadingState message="Running deep analysis..." isTakingLong={isTakingLong} />}
          {!loading && !result && !executionError && (
            <EmptyState
              message={deleted ? 'Analysis deleted.' : 'Your analysis will appear here.'}
              submessage={deleted ? 'Run the tool again to generate a new analysis.' : 'Fill in the inputs and run the tool to generate strategic intelligence.'}
            />
          )}

          {result && !loading && (
            <>
              <Card accent>
                {(config.scored || result.verdict) && (
                  <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      {config.scored && typeof result.score === 'number' && (
                        <>
                          <IntelligenceIndicator score={result.score} />
                          {(() => {
                            const b = getScoreBand(result.score);
                            return (
                              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${b.bgClass} ${b.textClass}`}>
                                {b.band}
                              </span>
                            );
                          })()}
                        </>
                      )}
                    </div>
                    {result.verdict && (
                      <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-[#0B0B0B] text-white">{result.verdict}</span>
                    )}
                  </div>
                )}
                {result.summary && (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Executive Summary</p>
                    <p className="text-sm text-gray-600 leading-relaxed font-medium">{result.summary}</p>
                  </>
                )}
                <div className="flex items-center justify-between gap-4 flex-wrap pt-6 mt-6 border-t border-gray-50">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="inline-flex items-center gap-2 text-[10px] font-bold text-green-600 uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Saved
                    </span>
                    <button onClick={handleRun} className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors">Rerun</button>
                    <button onClick={handleShare} className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors">Share</button>
                    <button onClick={handleDelete} className="text-[10px] font-bold text-gray-400 hover:text-[#FF0000] uppercase tracking-widest transition-colors">Delete</button>
                    {actionMsg && <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">{actionMsg}</span>}
                  </div>
                  <ExportControls
                    onCopy={handleCopy}
                    onExportText={handleExportTxt}
                    onExportCSV={handleExportCSV}
                    onExportPDF={handleExportPDF}
                    isPro={profile?.tier === 'pro'}
                  />
                </div>
              </Card>

              {result.sections.length > 0 && (
                <Card>
                  {/* Tabs (Tabs component takes no children, so render content below) */}
                  <div className="flex gap-8 border-b border-gray-100 mb-8 overflow-x-auto no-scrollbar">
                    {result.sections.map(section => (
                      <button
                        key={section.title}
                        onClick={() => setActiveTab(section.title)}
                        className={`pb-4 text-[11px] font-bold uppercase tracking-widest transition-all relative whitespace-nowrap ${activeSection?.title === section.title ? 'text-[#0B0B0B]' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        {section.title}
                        {activeSection?.title === section.title && (
                          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF0000] rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {activeSection?.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="w-1.5 h-1.5 rounded-full mt-2 bg-[#FF0000]" />
                        <p className="text-sm text-gray-600 leading-relaxed font-medium flex-1">{item}</p>
                      </div>
                    ))}
                    {activeSection && activeSection.items.length === 0 && (
                      <p className="text-gray-400 text-sm font-medium">No items in this section.</p>
                    )}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      <UsageLimitModal
        isOpen={showUsageModal}
        tier={profile?.tier || 'free'}
        reason={usageReason}
        onClose={() => setShowUsageModal(false)}
      />
    </div>
  );
};

export default ToolPage;
