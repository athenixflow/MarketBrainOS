
import React, { useState, useEffect } from 'react';
import AnimatedSection from '../components/AnimatedSection';
import { ExpectedOutcome } from '../components/ToolGuide';
import {
  PageHeader,
  Card,
  Input, 
  PrimaryButton, 
  EmptyState, 
  LoadingState, 
  ResultContainer, 
  ErrorMessage,
  ExportControls,
  HoneypotField,
  UsageLimitModal,
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
import { copyToClipboard, downloadAsText, printAsPDF, formatConversionDoctorExport } from '../services/exportService';
import { SecurityEngine } from '../services/securityEngine';
import { getScoreBand } from '../services/scoreBands';

const ConversionDoctor: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
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
  const [usageReason, setUsageReason] = useState<'exhausted' | 'insufficient'>('exhausted');

  const contexts = ['Landing Page', 'Homepage', 'Sales Page', 'Funnel Step'];

  useEffect(() => {
    let timer: number;
    if (loading) {
      timer = window.setTimeout(() => setIsTakingLong(true), 10000);
    } else {
      setIsTakingLong(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

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
            error: "Protocol missing. Use https://..." 
          };
        }
        return { 
          isValid: false, 
          error: "Invalid URL structure (e.g. domain.com)" 
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
          error: "Malformed URL format detected." 
        };
      }
    }
    
    return { isValid: trimmed.length > 0 };
  };

  const mode = detectMode(input);
  const validation = validateInputFormat(input);
  const showInlineError = input.trim().length > 0 && !validation.isValid;

  const checkTokenAvailability = (): boolean => {
    if (!profile) return false;
    if (profile.tokens === 0) {
      setUsageReason('exhausted');
      setShowUsageModal(true);
      return false;
    }
    if (profile.tier === 'free' && profile.tokens < TOKEN_COSTS.ConversionDoctor) {
      setUsageReason('insufficient');
      setShowUsageModal(true);
      return false;
    }
    return true;
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

    setLoading(true);
    setError(null);
    setExecutionError(null);
    setResult(null);
    try {
      const data = await auditConversion(trimmedInput, context, user?.uid, { audience, goal, trafficSource });
      setResult({ ...data, auditedUrl: trimmedInput.startsWith('http') ? trimmedInput : undefined });
      
      if (user) await refreshProfile();
      
    } catch (err: any) {
      console.error("Audit failed:", err);
      let errMsg = err.message || "Clinical engine interruption.";
      if (errMsg.includes("Extraction Failed") || errMsg.includes("404") || errMsg.includes("unreachable")) {
        errMsg = `Diagnostic Link Failure: The clinical engine could not access the provided URL. We suggest pasting raw copy for evaluation.`;
      }
      setExecutionError(errMsg);
    } finally {
      setLoading(false);
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
      copyToClipboard(text);
    }
  };

  const handleExportTxt = () => {
    if (result) {
      const text = formatConversionDoctorExport(result);
      downloadAsText("ConversionDoctor_Report", text);
    }
  };

  const handleExportPDF = () => {
    if (result) {
      const text = formatConversionDoctorExport(result);
      printAsPDF("Conversion Doctor Elite Diagnostic Report", text);
    }
  };

  const isSuspended = profile?.is_suspended;
  const isPro = profile?.tier === 'pro';

  return (
    <div className="space-y-12">
      {profile && <TokenStatusBanner tier={profile.tier} tokens={profile.tokens} />}
      <UsageLimitModal 
        isOpen={showUsageModal} 
        tier={profile?.tier || 'free'} 
        reason={usageReason} 
        onClose={() => setShowUsageModal(false)} 
      />

      <div className="space-y-24">
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

        <AnimatedSection index={1} className="max-w-4xl mx-auto w-full">
          <Card className="shadow-2xl">
            {isSuspended && <div className="mb-12"><ErrorMessage message="SECURITY PROTOCOL ACTIVE: Account suspended due to risk threshold violations." /></div>}
            {error && <div className="mb-12"><ErrorMessage message={error} action={{ label: "Start Over", onClick: handleReset }} /></div>}
            
            {!isSuspended && (
              <form onSubmit={(e) => { e.preventDefault(); handleAudit(); }}>
                <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
                <div className="relative">
                  <div className="flex justify-between items-center mb-[-40px] relative z-10 px-1 pointer-events-none">
                    <div />
                    {mode !== 'empty' && (
                      <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-2 duration-300">
                        <div className={`w-1 h-1 rounded-full ${mode === 'url' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                          Mode: {mode === 'url' ? 'Clinical URL Audit' : 'Raw Copy Diagnostic'}
                        </span>
                      </div>
                    )}
                  </div>
                  <Input 
                    label="Page Source" 
                    placeholder="Paste your page copy or enter a live URL (https://...)" 
                    value={input} 
                    onChange={(e) => { setInput(e.target.value); setError(null); }} 
                    multiline 
                    error={showInlineError ? validation.error : undefined}
                  />
                </div>

                <div className="flex justify-between items-start -mt-4 mb-6">
                  <div className="flex items-center gap-2">
                    {showInlineError && (
                      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" />
                         <p className="text-[9px] font-bold text-[#FF0000] uppercase tracking-widest">
                           Invalid Format: {validation.error}
                         </p>
                      </div>
                    )}
                  </div>
                  <p className={`text-right text-[9px] font-bold uppercase tracking-widest ${input.length > MAX_INPUT_CHARS ? 'text-[#FF0000]' : 'text-gray-300'}`}>
                    {input.length} / {MAX_INPUT_CHARS} characters
                  </p>
                </div>
                
                <div className="mb-12">
                  <label className="text-xs font-bold text-gray-700 mb-5 tracking-widest uppercase block">Page Context</label>
                  <div className="flex flex-wrap gap-3">
                    {contexts.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setContext(c)}
                        className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                          context === c ? 'bg-[#0B0B0B] text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-10">
                  <button type="button" onClick={() => setShowAdvanced(v => !v)}
                    className="flex items-center gap-2 text-[10px] font-bold text-gray-600 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors">
                    <span className="text-base leading-none w-4 text-center">{showAdvanced ? '−' : '+'}</span>
                    Advanced context (optional)
                  </button>
                  <p className="mt-2 mb-6 text-[11px] font-medium text-gray-500 leading-relaxed pl-6">Add context for a sharper, more tailored audit. All optional.</p>
                  {showAdvanced && (
                    <div>
                      <Input label="Target Audience" placeholder="Who is this page for?" value={audience} onChange={(e) => setAudience(e.target.value)} />
                      <p className="-mt-4 mb-6 text-[11px] font-medium text-gray-600 leading-relaxed">Who you’re trying to convert — the audit weighs friction differently per audience.<span className="text-gray-500"> e.g. First-time visitors from cold Meta ads.</span></p>
                      <Input label="Conversion Goal" placeholder="The one action you want" value={goal} onChange={(e) => setGoal(e.target.value)} />
                      <p className="-mt-4 mb-6 text-[11px] font-medium text-gray-600 leading-relaxed">The single action this page should drive.<span className="text-gray-500"> e.g. Start a free trial.</span></p>
                      <Input label="Traffic Source" placeholder="Where visitors come from" value={trafficSource} onChange={(e) => setTrafficSource(e.target.value)} />
                      <p className="-mt-4 mb-6 text-[11px] font-medium text-gray-600 leading-relaxed">How people arrive — intent differs by source.<span className="text-gray-500"> e.g. Google search, cold ads, email list.</span></p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-6">
                  <PrimaryButton 
                    type="submit"
                    disabled={loading || !input.trim() || input.length > MAX_INPUT_CHARS || !validation.isValid} 
                    className="w-full"
                  >
                    {loading ? 'Analyzing conversion structure...' : 'Run Conversion Audit'}
                  </PrimaryButton>
                  {result && !loading && (
                    <button 
                      type="button"
                      onClick={handleReset}
                      className="text-[10px] font-bold text-gray-300 hover:text-gray-500 uppercase tracking-widest transition-colors text-center"
                    >
                      Run another audit
                    </button>
                  )}
                </div>
              </form>
            )}
          </Card>
        </AnimatedSection>

        {loading && <LoadingState message="Extracting psychological signals..." isTakingLong={isTakingLong} onCancel={() => setLoading(false)} />}

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
            message="No audit yet." 
            submessage="Paste a page or enter a URL to begin the diagnostic evaluation." 
          />
        )}

        {result && !loading && (
          <ResultContainer>
            <div className="flex justify-end mb-12">
              <ExportControls 
                onCopy={handleCopy} 
                onExportText={handleExportTxt} 
                onExportPDF={handleExportPDF} 
                isPro={isPro} 
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <Card className="lg:col-span-1 flex flex-col justify-center items-center py-20 bg-gray-50/30" accent>
                 <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-[0.3em] mb-10">Conversion Grade</p>
                 <div className="text-8xl font-black tracking-tighter mb-4 text-[#0B0B0B]">{result.score}</div>
                 {(() => {
                   const b = getScoreBand(result.score);
                   return (
                     <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border mb-3 ${b.bgClass} ${b.textClass}`}>
                       {b.band}
                     </span>
                   );
                 })()}
                 <p className="font-bold text-gray-400 text-[10px] tracking-[0.2em] uppercase">Intelligence Confidence: High</p>
              </Card>

              <Card className="lg:col-span-2">
                <div className="space-y-8">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" />
                    <h2 className="text-lg font-bold tracking-tight text-[#0B0B0B] opacity-80 uppercase tracking-widest">Executive Diagnostic</h2>
                  </div>
                  {result.auditedUrl && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg w-fit">
                      <div className="w-1 h-1 rounded-full bg-blue-500" />
                      <span className="text-[10px] font-bold text-gray-400 truncate max-w-xs">{result.auditedUrl}</span>
                    </div>
                  )}
                  <p className="text-2xl font-bold text-[#0B0B0B] leading-snug">
                    {result.summary}
                  </p>
                  <div className="flex items-center gap-4 pt-6 border-t border-gray-50">
                     <div className="w-2 h-2 rounded-full bg-[#FF0000]" />
                     <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Consultant View Enabled</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Conversion blockers */}
            {result.issues && result.issues.length > 0 && (
              <Card className="mt-12">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" />
                  <h2 className="text-lg font-bold tracking-tight text-[#0B0B0B] uppercase tracking-widest">Conversion Blockers</h2>
                </div>
                <div className="space-y-3">
                  {result.issues.map((issue, i) => (
                    <div key={i} className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full mt-2 bg-[#FF0000] shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <p className="text-sm text-[#0B0B0B] leading-relaxed font-bold">{issue.blocker}</p>
                            {issue.severity && (
                              <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-red-50 text-red-500">{issue.severity}</span>
                            )}
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
              <Card className="mt-12">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" />
                  <h2 className="text-lg font-bold tracking-tight text-[#0B0B0B] uppercase tracking-widest">Prioritized Fixes</h2>
                </div>
                <div className="space-y-3">
                  {result.fixes.map((fix, i) => (
                    <div key={i} className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-sm text-[#0B0B0B] leading-relaxed font-bold">{fix.what}</p>
                        {fix.priority && (
                          <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-gray-200 text-gray-600">{fix.priority} priority</span>
                        )}
                      </div>
                      {fix.how && (
                        <div className="mt-3"><span className="text-[9px] font-black uppercase tracking-widest text-gray-500">How</span>
                          <p className="mt-1 text-sm text-gray-600 leading-relaxed font-medium">{fix.how}</p></div>
                      )}
                      {fix.expectedResult && (
                        <div className="mt-3"><span className="text-[9px] font-black uppercase tracking-widest text-[#FF0000]">Expected result</span>
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
              <Card className="mt-12">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" />
                  <h2 className="text-lg font-bold text-[#0B0B0B] uppercase tracking-widest">Rewrite Suggestions</h2>
                </div>
                <div className="space-y-3">
                  {result.rewrites.map((rw, i) => (
                    <div key={i} className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-3">{rw.label}</p>
                      {rw.original && (
                        <div className="mb-3">
                          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Current</span>
                          <p className="mt-1 text-sm text-gray-500 leading-relaxed line-through decoration-gray-300">"{rw.original}"</p>
                        </div>
                      )}
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#FF0000]">Rewrite</span>
                        <p className="mt-1 text-sm text-[#0B0B0B] font-bold leading-relaxed">"{rw.text}"</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(rw.text)}
                        className="mt-4 text-[9px] font-bold text-[#FF0000] hover:opacity-60 transition-opacity uppercase tracking-widest border-b border-[#FF0000]/10 pb-1"
                      >
                        Copy rewrite
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* When the audit produced neither blockers nor fixes, say so rather than leaving the
                page as a bare score with no explanation of what happened. */}
            {(result.issues || []).length === 0 && (result.fixes || []).length === 0 && (
              <Card className="mt-12">
                <p className="text-sm text-gray-500 font-medium leading-relaxed text-center">
                  This audit did not surface specific blockers or fixes. That usually means the input was
                  too short to analyse. Paste the full page copy and rerun for a detailed diagnosis.
                </p>
              </Card>
            )}
          </ResultContainer>
        )}
      </div>
    </div>
  );
};

export default ConversionDoctor;
