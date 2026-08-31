import React, { useState, useEffect, useMemo } from 'react';
import AnimatedSection from './AnimatedSection';
import {
  PageHeader,
  Card,
  Input,
  PrimaryButton,
  IntelligenceIndicator,
  EmptyState,
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
import { ToolConfig, getToolMeta, getToolGuide } from '../config/toolConfigs';
import { getUserToolAnalyses, ToolAnalysisRecord, deleteGenericAnalysis, saveReport } from '../services/persistenceService';
import { getScoreBand } from '../services/scoreBands';
import { ExpectedOutcome, AnalysisPreview, RunProgress, CharCounter, RunStage } from './ToolGuide';
import { ResultItemList } from './ResultSections';

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
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loading, setLoading] = useState(false);
  const [runStage, setRunStage] = useState<RunStage>('queued');
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
  const [savingReport, setSavingReport] = useState(false);
  const [deleted, setDeleted] = useState(false);

  // Phase 6.1: when acting inside a team workspace, let the user choose per-run whether the
  // result is shared with the team or kept private to themselves.
  const inTeamScope = scope.level === 'team' && !!scope.workspaceId;
  const [visibilityChoice, setVisibilityChoice] = useState<'workspace' | 'private'>('workspace');

  const cost = TOKEN_COSTS[config.costKey];
  const primaryField = config.inputs.find(f => f.primary) || config.inputs.find(f => f.multiline) || config.inputs[0];
  const guide = getToolGuide(config);

  // Institutional forms: essentials stay visible; `advanced` fields collapse under a disclosure.
  const essentialFields = config.inputs.filter(f => f.group !== 'advanced');
  const advancedFields = config.inputs.filter(f => f.group === 'advanced');

  // One renderer for both groups (option button-group OR text Input + helper/example + counter).
  const renderField = (field: ToolConfig['inputs'][number]) => (
    field.options ? (
      <div key={field.key} className="mb-6">
        <label className="block text-[11px] font-bold text-gray-500 mb-2 tracking-widest uppercase">{field.label}</label>
        {/* grid-cols-1 base: at 390px two columns left ~119px per button for a bold label. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {field.options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setField(field.key, opt)}
              className={`px-4 py-3 rounded-xl text-xs font-bold transition-all ${values[field.key] === opt ? 'bg-[#0B0B0B] text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
            >
              {opt}
            </button>
          ))}
        </div>
        {(field.description || field.example) && (
          <p className="mt-4 text-[11px] font-medium text-gray-600 leading-relaxed">
            {field.description}{field.example ? <span className="text-gray-500"> e.g. {field.example}</span> : null}
          </p>
        )}
      </div>
    ) : (
      <div key={field.key}>
        <Input
          label={field.label}
          placeholder={field.placeholder}
          value={values[field.key] || ''}
          onChange={(e) => setField(field.key, e.target.value)}
          multiline={field.multiline}
        />
        {(field.description || field.example) && (
          <p className="-mt-4 mb-6 text-[11px] font-medium text-gray-600 leading-relaxed">
            {field.description}{field.example ? <span className="text-gray-500"> e.g. {field.example}</span> : null}
          </p>
        )}
        {field.multiline && (
          <CharCounter value={values[field.key] || ''} max={field.maxLength || MAX_INPUT_CHARS} />
        )}
      </div>
    )
  );

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
        .map((it: any) => (typeof it === 'string' ? it : (it?.insight || '')))
        .filter(Boolean)
        .join('; ');
      contextText = `${label} analysis — ${selected.result?.summary || ''}${highlights ? ' Highlights: ' + highlights : ''}`.trim();
    }

    setLoading(true);
    setRunStage('queued');
    setError(null);
    setExecutionError(null);
    setResult(null);
    setActionMsg('');
    setDeleted(false);
    try {
      // Brief "queued" beat before the request so the staged progress reads naturally.
      await new Promise((r) => setTimeout(r, 450));
      setRunStage('running');
      // Stamp the chosen scope: in a team workspace the user can keep a run Private.
      const effectiveScope = inTeamScope && visibilityChoice === 'private' ? { level: 'personal' as const } : scope;
      const data = await runToolAnalysis(config.module, values, user?.uid, contextText, effectiveScope);
      setRunStage('completed');
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
  // saveReport() existed but had no call sites anywhere, so /reports could never populate and its
  // empty state told users to "save it as a report" - an action that did not exist in the UI.
  const handleSaveReport = async () => {
    if (!user || !result) return;
    setSavingReport(true);
    try {
      await saveReport(user.uid, {
        title: `${config.title} — ${new Date().toLocaleDateString()}`,
        report_type: 'analysis',
        content: { score: result.score, verdict: result.verdict, summary: result.summary, sections: result.sections },
      }, scope);
      setActionMsg('Saved to Reports');
    } catch (e: any) {
      console.error(e);
      setActionMsg(e?.message || 'Could not save report');
    } finally {
      setSavingReport(false);
      setTimeout(() => setActionMsg(''), 3000);
    }
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
      <PageHeader title={config.title} subtitle={guide.purpose} />

      <ExpectedOutcome outcomes={guide.outcomes} estimatedTime={guide.estimatedTime} analyzes={guide.description} />

      {/* grid-cols-1 is REQUIRED at the base breakpoint: without it the implicit track is `auto`
          (minmax(min-content, max-content)), which is not clamped to the container and lets a long
          child blow the page wider than the viewport. grid-cols-1 emits minmax(0,1fr) (minimum 0). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* INPUT PANEL */}
        <AnimatedSection index={0}>
          <Card>
            <div className="space-y-2">
              {essentialFields.map(renderField)}

              {advancedFields.length > 0 && (
                <div className="mb-10">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(v => !v)}
                    className="flex items-center gap-2 text-[10px] font-bold text-gray-600 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors"
                  >
                    <span className="text-base leading-none w-4 text-center">{showAdvanced ? '−' : '+'}</span>
                    Advanced context (optional)
                  </button>
                  <p className="mt-2 mb-6 text-[11px] font-medium text-gray-500 leading-relaxed pl-6">
                    The more context you add here, the deeper and more tailored your analysis. All optional.
                  </p>
                  {showAdvanced && <div className="space-y-2">{advancedFields.map(renderField)}</div>}
                </div>
              )}

              {priorAnalyses.length > 0 && (
                <div className="mb-12">
                  <label className="block text-xs font-bold text-gray-700 mb-5 tracking-widest uppercase">
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
                  <p className="mt-3 text-[10px] font-medium text-gray-600 leading-relaxed">
                    Feeds a related saved analysis into this tool for connected intelligence.
                  </p>
                </div>
              )}

              {inTeamScope && (
                <div className="mb-8">
                  <label className="block text-xs font-bold text-gray-700 mb-3 tracking-widest uppercase">Save this analysis as</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['workspace', 'private'] as const).map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setVisibilityChoice(opt)}
                        className={`px-4 py-3 rounded-xl text-xs font-bold transition-all ${visibilityChoice === opt ? 'bg-[#0B0B0B] text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                      >
                        {opt === 'workspace' ? 'Shared with team' : 'Private to me'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />

              <AnalysisPreview
                inputs={config.inputs.map(f => ({ label: f.label, value: values[f.key] || '' }))}
                analysisType={guide.analysisType}
                deliverables={guide.outcomes.length}
                cost={cost}
              />

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
          {loading && <RunProgress stage={runStage} isTakingLong={isTakingLong} />}
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
                    <button onClick={handleSaveReport} disabled={savingReport} className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors disabled:opacity-40">
                      {savingReport ? 'Saving…' : 'Save as report'}
                    </button>
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

                  {activeSection && <ResultItemList items={activeSection.items} />}
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
