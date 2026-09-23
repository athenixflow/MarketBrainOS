
import React, { useState, useEffect } from 'react';
import AnimatedSection from '../components/AnimatedSection';
import { ExpectedOutcome, FieldHint, CharCounter, TAKING_LONG_MS } from '../components/ToolGuide';
import {
  PageHeader,
  Card,
  Input,
  PrimaryButton,
  EmptyState,
  LoadingState,
  ResultContainer,
  Badge,
  ErrorMessage,
  ExportControls,
  HoneypotField,
  UsageLimitModal,
  CopyButton,
  TokenStatusBanner,
  AnalysisFailureState,
  SystemBlockState,
  RateLimitState,
  NetworkErrorState,
  isSystemBlockError,
  isRateLimitError,
  isNetworkError
} from '../components/UI';
import { auditConversion, MAX_INPUT_CHARS } from '../services/geminiService';
import { AuditResult, TOKEN_COSTS } from '../types';
import { useAuth } from '../context/AuthContext';
import { copyToClipboard, downloadAsText, exportTextPdf, formatConversionDoctorExport } from '../services/exportService';
import { SecurityEngine } from '../services/securityEngine';
import { getScoreBand } from '../services/scoreBands';
import { isFixtureRequested } from '../services/devFixtures';
import { checkTokenBalance, canExport, TokenVerdict } from '../config/access';
import { useScope } from '../context/ScopeContext';
import { useRunGuard, IN_FLIGHT_NOTE } from '../components/useRunGuard';

const chip = (active: boolean) =>
  `px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${active ? 'bg-[#0B0B0B] text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`;

type BadgeTone = 'neutral' | 'red' | 'green' | 'blue' | 'yellow' | 'dark';
const severityTone = (s?: string): BadgeTone => {
  const v = (s || '').toLowerCase();
  if (v === 'critical' || v === 'high') return 'red';
  if (v === 'medium') return 'yellow';
  return 'neutral';
};

const ConversionDoctor: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { memberships } = useScope();
  const run = useRunGuard();
  const [input, setInput] = useState('');
  const [context, setContext] = useState('Landing Page');
  const [audience, setAudience] = useState('');
  const [goal, setGoal] = useState('');
  const [trafficSource, setTrafficSource] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isTakingLong, setIsTakingLong] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [honeypotValue, setHoneypotValue] = useState('');

  // Usage Modal State
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [usageReason, setUsageReason] = useState<Exclude<TokenVerdict, 'ok'>>('exhausted');

  const contexts = ['Landing Page', 'Homepage', 'Sales Page', 'Funnel Step'];

  useEffect(() => {
    let timer: number;
    if (loading) {
      timer = window.setTimeout(() => setIsTakingLong(true), TAKING_LONG_MS);
    } else {
      setIsTakingLong(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  // Dev-only: render a sample result (no tokens spent) for screenshots. Dead code in production.
  useEffect(() => {
    if (!isFixtureRequested()) return;
    import('../services/devFixtures').then((m) => setResult({ ...m.CONVERSION_DOCTOR_FIXTURE }));
  }, []);

  const detectMode = (str: string): 'url' | 'text' | 'empty' => {
    const trimmed = str.trim();
    if (!trimmed) return 'empty';
    return (!trimmed.includes(' ') && trimmed.includes('.')) ? 'url' : 'text';
  };

  const validateInputFormat = (str: string): { isValid: boolean; error?: string } => {
    const trimmed = str.trim();
    if (!trimmed) return { isValid: false };

    const currentMode = detectMode(trimmed);

    if (currentMode === 'url') {
      const urlPattern = /^(https?:\/\/)(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/;

      if (!urlPattern.test(trimmed)) {
        if (!trimmed.toLowerCase().startsWith('http')) {
          return {
            isValid: false,
            error: "Add the protocol, e.g. https://example.com"
          };
        }
        return {
          isValid: false,
          error: "That does not look like a valid URL (e.g. https://domain.com)"
        };
      }

      try {
        const url = new URL(trimmed);
        const hasValidProtocol = url.protocol === 'http:' || url.protocol === 'https:';
        if (!hasValidProtocol) throw new Error();
        return { isValid: true };
      } catch {
        return {
          isValid: false,
          error: "That URL could not be parsed."
        };
      }
    }

    return { isValid: trimmed.length > 0 };
  };

  const mode = detectMode(input);
  const validation = validateInputFormat(input);
  const showInlineError = input.trim().length > 0 && !validation.isValid;

  const checkTokenAvailability = (): boolean => {
    // Shared guard - see checkTokenBalance in config/access.ts for why the old inline version
    // let an unhydrated profile and low-balance paid accounts through to the paid endpoint.
    const verdict = checkTokenBalance(profile, TOKEN_COSTS.ConversionDoctor);
    if (verdict === "ok") return true;
    setUsageReason(verdict);
    setShowUsageModal(true);
    return false;
  };

  const handleAudit = async () => {
    if (honeypotValue) {
      await SecurityEngine.handleHoneypotTrigger(profile);
      setError("Security violation detected.");
      return;
    }

    const trimmedInput = input.trim();
    if (!trimmedInput || !validation.isValid) return;

    if (trimmedInput.length > MAX_INPUT_CHARS) {
      setError(`Page content exceeds safety limits (${trimmedInput.length}/${MAX_INPUT_CHARS}). Please consolidate.`);
      return;
    }

    // Token Check
    if (!checkTokenAvailability()) return;

    if (profile && profile.is_suspended) {
      setError("Account operations suspended.");
      return;
    }

    const token = run.start();
    setLoading(true);
    setError(null);
    setExecutionError(null);
    setResult(null);
    try {
      const data = await auditConversion(trimmedInput, context, user?.uid, { audience, goal, trafficSource });
      if (!run.isCurrent(token)) return;
      // `auditedUrl` comes from the server and only when it genuinely fetched the page - see auditConversion.
      setResult({ ...data });

      if (user) await refreshProfile();

    } catch (err: any) {
      console.error("Audit failed:", err);
      if (!run.isCurrent(token)) return;
      // The server now returns a specific, actionable reason for an unreadable page ("That page
      // returned 404 Not Found", "...resolves to a private address"). Replacing it with generic advice
      // - as this used to - threw away the only part the user could act on.
      setExecutionError(err.message || "The audit was interrupted before it finished. No tokens were deducted.");
    } finally {
      run.settle();
      if (run.isCurrent(token)) setLoading(false);
    }
  };

  const handleReset = () => {
    setInput('');
    setResult(null);
    setError(null);
    setExecutionError(null);
    setHoneypotValue('');
  };

  const handleCopy = () => {
    if (result) {
      const text = formatConversionDoctorExport(result);
      return copyToClipboard(text);
    }
  };

  const handleExportTxt = () => {
    if (result) {
      const text = formatConversionDoctorExport(result);
      downloadAsText("ConversionDoctor_Report", text);
    }
  };

  const handleExportPDF = () => {
    if (!result) return;
    return exportTextPdf("Conversion Doctor Elite Diagnostic Report", formatConversionDoctorExport(result));
  };

  const isSuspended = profile?.is_suspended;
  // Every paying plan, plus invited members - see canExport. `tier === 'pro'` locked out Team/Agency/Enterprise.
  const isPro = canExport({ profile, memberships });

  return (
    <div className="space-y-12">
      {profile && <TokenStatusBanner tier={profile.tier} tokens={profile.tokens} />}
      <UsageLimitModal
        isOpen={showUsageModal}
        tier={profile?.tier || 'free'}
        reason={usageReason}
        onClose={() => setShowUsageModal(false)}
      />

      <div className="space-y-16">
        <AnimatedSection index={0}>
          <PageHeader
            title="Conversion Doctor: Landing Page Audit"
            subtitle="Identify conversion blockers, friction points, and messaging gaps. Clinical diagnostic tools for high-performance landing pages."
          />
          <ExpectedOutcome
            estimatedTime="30–60 seconds"
            analyzes="Diagnoses your landing page or funnel for the issues quietly costing you conversions."
            outcomes={['Conversion Score', 'Critical Blockers', 'Friction Points', 'Prioritized Fixes', 'Rewrite Suggestions']}
          />
        </AnimatedSection>

        <AnimatedSection index={1}>
          <Card className="shadow-2xl">
            {isSuspended && <div className="mb-10"><ErrorMessage message="Your account is suspended. Analyses are disabled until an administrator restores access." /></div>}
            {error && <div className="mb-10"><ErrorMessage message={error} action={{ label: "Start over", onClick: handleReset }} /></div>}

            {!isSuspended && (
              <form onSubmit={(e) => { e.preventDefault(); handleAudit(); }}>
                <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
                <Input
                  label="Page source"
                  placeholder="Paste your page copy or enter a live URL (https://...)"
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setError(null); }}
                  multiline
                  error={showInlineError ? validation.error : undefined}
                  labelRight={mode !== 'empty' ? (
                    <Badge tone={mode === 'url' ? 'blue' : 'neutral'}>{mode === 'url' ? 'URL audit' : 'Copy audit'}</Badge>
                  ) : undefined}
                  hint={
                    <>
                      <FieldHint>A live URL is fetched and audited as-is. Pasted copy is audited exactly as written.</FieldHint>
                      <CharCounter value={input} max={MAX_INPUT_CHARS} />
                    </>
                  }
                />

                <div className="mb-8">
                  <p className="text-[11px] font-bold text-gray-500 mb-3 tracking-widest uppercase">Page context</p>
                  <div className="flex flex-wrap gap-2">
                    {contexts.map(c => (
                      <button key={c} type="button" onClick={() => setContext(c)} aria-pressed={context === c} className={chip(context === c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/*
                  REQUIRED, AND SAID OUT LOUD. A page cannot be audited well without
                  knowing who it is for and what it should make them do: the same
                  headline is strong for a warm list and weak for cold traffic, and a
                  grader that does not ask is grading against a generic idea of "good".
                  Independent testing found one of eleven AI auditors asks. Both fields
                  existed here already — collapsed inside "Advanced (optional)", which
                  almost nobody opens, so the product's sharpest difference was hidden
                  behind a disclosure triangle.
                */}
                <div className="mb-10">
                  <p className="mb-6 text-[11px] font-bold text-[#0B0B0B] uppercase tracking-widest">
                    Required — this is what makes the audit yours
                  </p>
                  <Input label="Target audience" placeholder="Who is this page for?" value={audience} onChange={(e) => setAudience(e.target.value)}
                    hint={<FieldHint example="First-time visitors from cold Meta ads.">Who you’re trying to convert. The same page is strong for a warm list and weak for cold traffic — most auditors never ask.</FieldHint>} />
                  <Input label="Conversion goal" placeholder="The one action you want" value={goal} onChange={(e) => setGoal(e.target.value)}
                    hint={<FieldHint example="Start a free trial.">The single action this page should drive. Every blocker is weighed against it.</FieldHint>} />
                </div>

                <div className="mb-10">
                  <button type="button" onClick={() => setShowAdvanced(v => !v)} aria-expanded={showAdvanced}
                    className="flex items-center gap-2 text-[10px] font-bold text-gray-600 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors">
                    <span className="text-base leading-none w-4 text-center">{showAdvanced ? '−' : '+'}</span>
                    Advanced context (optional)
                  </button>
                  <p className="mt-2 mb-6 text-[11px] font-medium text-gray-500 leading-relaxed pl-6">Add context for a sharper, more tailored audit. All optional.</p>
                  {showAdvanced && (
                    <div>
                      <Input label="Traffic source" placeholder="Where visitors come from" value={trafficSource} onChange={(e) => setTrafficSource(e.target.value)}
                        hint={<FieldHint example="Google search, cold ads, email list.">How people arrive. Intent differs by source.</FieldHint>} />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-6">
                  <PrimaryButton
                    type="submit"
                    disabled={loading || run.inFlight || !input.trim() || input.length > MAX_INPUT_CHARS || !validation.isValid || !audience.trim() || !goal.trim()}
                    className="w-full"
                  >
                    {loading ? 'Auditing your page…' : run.inFlight ? 'Finishing previous run…' : 'Run conversion audit'}
                  </PrimaryButton>
                  {!loading && run.inFlight && <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed text-center">{IN_FLIGHT_NOTE}</p>}
                  {/*
                    A DISABLED CONTROL MUST SAY WHY. The QA audit found the token store
                    greyed out with no reason given, and a person who cannot tell whether
                    a button is broken or waiting for them assumes broken. Names the
                    missing field rather than "complete the form".
                  */}
                  {!loading && !run.inFlight && input.trim() && validation.isValid && (!audience.trim() || !goal.trim()) && (
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed text-center">
                      {!audience.trim() && !goal.trim()
                        ? 'Add the audience and the conversion goal to run the audit'
                        : !audience.trim()
                          ? 'Add the target audience to run the audit'
                          : 'Add the conversion goal to run the audit'}
                    </p>
                  )}
                  {result && !loading && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors text-center"
                    >
                      Run another audit
                    </button>
                  )}
                </div>
              </form>
            )}
          </Card>
        </AnimatedSection>

        {loading && <LoadingState message="Auditing your page…" isTakingLong={isTakingLong} onCancel={() => { run.stopWaiting(); setLoading(false); }} />}

        {executionError && isSystemBlockError(executionError) ? (
           <SystemBlockState message={executionError} />
        ) : executionError && isNetworkError(executionError) ? (
           <NetworkErrorState message={executionError} onRetry={handleAudit} />
        ) : executionError && isRateLimitError(executionError) ? (
           <RateLimitState message={executionError} />
        ) : executionError ? (
           <AnalysisFailureState message={executionError} onRetry={() => setExecutionError(null)} />
        ) : null}

        {!result && !loading && !error && !executionError && (
          <EmptyState
            card
            message="No audit yet"
            submessage="Paste a page or enter a URL above to run the diagnostic."
          />
        )}

        {result && !loading && (
          <ResultContainer>
            <div className="flex justify-end mb-8">
              <ExportControls
                tone="dark"
                onCopy={handleCopy}
                onExportText={handleExportTxt}
                onExportPDF={handleExportPDF}
                isPro={isPro}
                unsaved={result?.saveError}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-1 flex flex-col justify-center items-center py-16" accent>
                 <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-8">Conversion grade</p>
                 <div className="text-7xl sm:text-8xl font-black tracking-tighter tabular-nums mb-4 text-[#0B0B0B]">{result.score}</div>
                 {(() => {
                   const b = getScoreBand(result.score);
                   return (
                     <span className={`text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full border ${b.bgClass} ${b.textClass}`}>
                       {b.band}
                     </span>
                   );
                 })()}
              </Card>

              <Card className="lg:col-span-2" title="Diagnosis">
                <div className="space-y-6">
                  {result.auditedUrl && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-full w-fit max-w-full">
                      <div className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                      <span className="text-[10px] font-bold text-gray-400 truncate">{result.auditedUrl}</span>
                    </div>
                  )}
                  <p className="text-xl sm:text-2xl font-bold text-[#0B0B0B] leading-snug">
                    {result.summary}
                  </p>
                </div>
              </Card>
            </div>

            {/* Conversion blockers */}
            {result.issues && result.issues.length > 0 && (
              <Card className="mt-8" title="Conversion blockers">
                <div className="space-y-3">
                  {result.issues.map((issue, i) => (
                    <div key={i} className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full mt-2 bg-[#FF0000] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <p className="text-sm text-[#0B0B0B] leading-relaxed font-bold">{issue.blocker}</p>
                            {issue.severity && <Badge tone={severityTone(issue.severity)}>{issue.severity}</Badge>}
                          </div>
                          {issue.impact && <p className="mt-2 text-sm text-gray-600 leading-relaxed font-medium">{issue.impact}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Prioritized fixes */}
            {result.fixes && result.fixes.length > 0 && (
              <Card className="mt-8" title="Prioritized fixes">
                <div className="space-y-3">
                  {result.fixes.map((fix, i) => (
                    <div key={i} className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-sm text-[#0B0B0B] leading-relaxed font-bold">{fix.what}</p>
                        {fix.priority && <Badge tone={severityTone(fix.priority)}>{fix.priority} priority</Badge>}
                      </div>
                      {fix.how && (
                        <div className="mt-3"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">How</span>
                          <p className="mt-1 text-sm text-gray-600 leading-relaxed font-medium">{fix.how}</p></div>
                      )}
                      {fix.expectedResult && (
                        <div className="mt-3"><span className="text-[10px] font-bold uppercase tracking-widest text-[#FF0000]">Expected result</span>
                          <p className="mt-1 text-sm text-gray-700 leading-relaxed font-semibold">{fix.expectedResult}</p></div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Rewrite suggestions: promised by the tool's stated deliverables and declared on
                AuditResult, but the prompt never asked for them and nothing rendered them. */}
            {result.rewrites && result.rewrites.length > 0 && (
              <Card className="mt-8" title="Rewrite suggestions">
                <div className="space-y-3">
                  {result.rewrites.map((rw, i) => (
                    <div key={i} className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">{rw.label}</p>
                      {rw.original && (
                        <div className="mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Current</span>
                          <p className="mt-1 text-sm text-gray-500 leading-relaxed line-through decoration-gray-300">"{rw.original}"</p>
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF0000]">Rewrite</span>
                        <p className="mt-1 text-sm text-[#0B0B0B] font-bold leading-relaxed">"{rw.text}"</p>
                      </div>
                      <CopyButton text={rw.text} label="Copy rewrite" className="mt-4 text-[10px] font-bold text-[#FF0000] hover:opacity-60 transition-opacity uppercase tracking-widest border-b border-[#FF0000]/10 pb-1" />
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* When the audit produced neither blockers nor fixes, say so rather than leaving the
                page as a bare score with no explanation of what happened. */}
            {(result.issues || []).length === 0 && (result.fixes || []).length === 0 && (
              <EmptyState
                card
                className="mt-8"
                message="No specific blockers or fixes were found"
                submessage="That usually means the input was too short to analyse. Paste the full page copy and rerun for a detailed diagnosis."
              />
            )}
          </ResultContainer>
        )}
      </div>
    </div>
  );
};

export default ConversionDoctor;
