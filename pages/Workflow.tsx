
import React, { useState, useEffect } from 'react';
import AnimatedSection from '../components/AnimatedSection';
import { ExpectedOutcome, TAKING_LONG_MS } from '../components/ToolGuide';
import {
  PageHeader,
  Card,
  Input, 
  PrimaryButton, 
  SecondaryButton,
  IntelligenceIndicator, 
  LoadingState, 
  ResultContainer, 
  SectionHeader,
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
import { 
  analyzeMarketingAngle, 
  runTestLabComparison, 
  auditConversion, 
  improveWorkflowAssets 
} from '../services/geminiService';
import { AngleMinerResults, TestLabResults, AuditResult, TOKEN_COSTS } from '../types';
import { useAuth } from '../context/AuthContext';
import { copyToClipboard, downloadAsText, exportTextPdf, formatWorkflowExport } from '../services/exportService';
import { SecurityEngine } from '../services/securityEngine';
import { checkTokenBalance, canExport, TokenVerdict } from '../config/access';
import { useScope } from '../context/ScopeContext';
import { useRunGuard, IN_FLIGHT_NOTE } from '../components/useRunGuard';
import { resolveWinner } from '../services/resultItems';

const Workflow: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { memberships } = useScope();
  const run = useRunGuard();
  const [step, setStep] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [isTakingLong, setIsTakingLong] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [honeypotValue, setHoneypotValue] = useState('');

  // Usage Modal State
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [usageReason, setUsageReason] = useState<Exclude<TokenVerdict, 'ok'>>('exhausted');

  // Step 1: AngleMiner X
  const [minerParams, setMinerParams] = useState({ product: '', industry: '', target: '', goal: 'All', tones: [] as string[], competitors: '', objections: '', brandVoice: '' });
  const [wfAdvanced, setWfAdvanced] = useState(false);
  const [minerResults, setMinerResults] = useState<AngleMinerResults | null>(null);

  // Step 2: Selection
  const [selectedAngleTexts, setSelectedAngleTexts] = useState<string[]>([]);

  // Step 3: TestLab Pro
  const [testResults, setTestResults] = useState<TestLabResults | null>(null);

  // Step 4: Conversion Doctor
  const [auditInput, setAuditInput] = useState('');
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);

  // Step 5: Improvement pipeline
  const [finalImprovements, setFinalImprovements] = useState<{ headline: string; cta: string; offer: string } | null>(null);

  useEffect(() => {
    let timer: number;
    if (loading) {
      // `loading` flips per step, so this is 45 s per step, not per workflow.
      timer = window.setTimeout(() => setIsTakingLong(true), TAKING_LONG_MS);
    } else {
      setIsTakingLong(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const nextStep = () => {
    setStep(s => s + 1);
    setError(null);
    setExecutionError(null);
  };
  const prevStep = () => {
    setStep(s => s - 1);
    setError(null);
    setExecutionError(null);
  };

  const checkHoneypot = async () => {
    if (honeypotValue) {
      await SecurityEngine.handleHoneypotTrigger(profile);
      setError("Security violation detected.");
      return true;
    }
    return false;
  };

  const checkTokenAvailability = (cost: number = 0): boolean => {
    // Shared guard - see checkTokenBalance in config/access.ts for why the old inline version
    // let an unhydrated profile and low-balance paid accounts through to the paid endpoint.
    const verdict = checkTokenBalance(profile, cost);
    if (verdict === "ok") return true;
    setUsageReason(verdict);
    setShowUsageModal(true);
    return false;
  };

  const handleStartMiner = async () => {
    if (await checkHoneypot()) return;
    if (minerParams.product.length < 20) {
      setError("Please add a bit more detail to the product description.");
      return;
    }

    // Step 1 calls AngleMiner_Generate (Cost 3)
    if (!checkTokenAvailability(TOKEN_COSTS.AngleMiner)) return;

    const token = run.start();
    setLoading(true);
    setError(null);
    setExecutionError(null);
    try {
      const data = await analyzeMarketingAngle(minerParams); 
      if (!run.isCurrent(token)) return;
      setMinerResults(data);
      // We must refresh profile because tokens were deducted on server
      if (user) await refreshProfile(); 
      nextStep();
    } catch (err: any) {
      if (!run.isCurrent(token)) return;
      setExecutionError(err.message || "Generating angles failed.");
    } finally {
      run.settle();
      if (run.isCurrent(token)) setLoading(false);
    }
  };

  const handleStartTest = async () => {
    if (await checkHoneypot()) return;
    if (selectedAngleTexts.length < 2) {
      setError("Please select at least 2 angles.");
      return;
    }

    // Step 3 calls TestLab_Simulation (Cost 5)
    if (!checkTokenAvailability(TOKEN_COSTS.TestLab)) return;

    const token = run.start();
    setLoading(true);
    setError(null);
    setExecutionError(null);
    try {
      const data = await runTestLabComparison('Angles', selectedAngleTexts); 
      if (!run.isCurrent(token)) return;
      setTestResults(data);
      if (user) await refreshProfile();
      nextStep();
    } catch (err: any) {
      if (!run.isCurrent(token)) return;
      setExecutionError(err.message || "The comparison did not finish.");
    } finally {
      run.settle();
      if (run.isCurrent(token)) setLoading(false);
    }
  };

  const handleStartAudit = async () => {
    if (await checkHoneypot()) return;
    if (!auditInput) return;

    // Step 4 calls ConversionDoctor_Audit (Cost 4)
    if (!checkTokenAvailability(TOKEN_COSTS.ConversionDoctor)) return;

    const token = run.start();
    setLoading(true);
    setError(null);
    setExecutionError(null);
    try {
      const data = await auditConversion(auditInput, 'Landing Page');
      if (!run.isCurrent(token)) return;
      setAuditResult(data);
      if (user) await refreshProfile();
      nextStep();
    } catch (err: any) {
      if (!run.isCurrent(token)) return;
      setExecutionError(err.message || "Audit engine failed.");
    } finally {
      run.settle();
      if (run.isCurrent(token)) setLoading(false);
    }
  };

  const handleRunImprovement = async () => {
    if (await checkHoneypot()) return;
    if (!testResults || !auditResult) return;
    const winner = resolveWinner(testResults.variants, testResults.winnerLabel);
    if (!winner) {
      setError("Validation Error: No winning variant found in test results.");
      return;
    }

    // Step 5 calls Workflow_ImproveAssets (Cost 6)
    if (!checkTokenAvailability(TOKEN_COSTS.Workflow)) return;

    const token = run.start();
    setLoading(true);
    setError(null);
    setExecutionError(null);
    try {
      const issues = (auditResult.issues || []).map(i => i.blocker);
      
      const data = await improveWorkflowAssets(
        winner.text, 
        issues, 
        user?.uid,
        winner.score,
        auditResult.score
      );
      if (!run.isCurrent(token)) return;
      setFinalImprovements(data);
      if (user) await refreshProfile();
      nextStep();
    } catch (err: any) {
      if (!run.isCurrent(token)) return;
      setExecutionError(err.message || "Asset refinement failed.");
    } finally {
      run.settle();
      if (run.isCurrent(token)) setLoading(false);
    }
  };

  const toggleAngleSelection = (text: string) => {
    setSelectedAngleTexts(prev => 
      prev.includes(text) ? prev.filter(t => t !== text) : [...prev, text].slice(0, 3)
    );
  };

  const winningVariant = resolveWinner(testResults?.variants, testResults?.winnerLabel);
  const winningAngleText = winningVariant?.text;
  const winningAngleScore = winningVariant?.score || 0;

  const handleCopy = () => {
    if (winningAngleText && auditResult && finalImprovements) {
      const text = formatWorkflowExport({
        angle: winningAngleText,
        testScore: winningAngleScore,
        conversionScore: auditResult.score,
        finalAssets: finalImprovements
      });
      return copyToClipboard(text);
    }
  };

  const handleExportTxt = () => {
    if (winningAngleText && auditResult && finalImprovements) {
      const text = formatWorkflowExport({
        angle: winningAngleText,
        testScore: winningAngleScore,
        conversionScore: auditResult.score,
        finalAssets: finalImprovements
      });
      downloadAsText("Workflow_Summary", text);
    }
  };

  const handleExportPDF = () => {
    if (!(winningAngleText && auditResult && finalImprovements)) return;
    const text = formatWorkflowExport({
      angle: winningAngleText,
      testScore: winningAngleScore,
      conversionScore: auditResult.score,
      finalAssets: finalImprovements
    });
    return exportTextPdf("MarketBrainOS Workflow Summary", text);
  };

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

      <AnimatedSection index={0} className="flex flex-wrap justify-between items-center gap-4 mb-8">
        <div className="flex flex-wrap items-center gap-4 min-w-0">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 py-2 bg-[#121212] rounded-full border border-gray-900 tabular-nums whitespace-nowrap">
            Step {Math.max(1, step)} of 6
          </div>
          <div className="h-1 w-full sm:w-48 bg-gray-900 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#FF0000] transition-all duration-700" 
              style={{ width: `${(step / 6) * 100}%` }} 
            />
          </div>
        </div>
        {step > 0 && step < 6 && (
          <button 
            onClick={() => setStep(0)}
            className="text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-colors"
          >
            Exit workflow
          </button>
        )}
      </AnimatedSection>

      {error && <div className="max-w-4xl mx-auto"><ErrorMessage message={error} action={{ label: "Retry", onClick: () => setError(null) }} /></div>}
      
      {/* Execution Errors (Server-side) */}
      {executionError && isSystemBlockError(executionError) ? (
         <div className="max-w-4xl mx-auto mb-12">
           <SystemBlockState message={executionError} />
         </div>
      ) : executionError && isNetworkError(executionError) ? (
         <div className="max-w-4xl mx-auto mb-12">
           <NetworkErrorState message={executionError} onRetry={
             step === 1 ? handleStartMiner : 
             step === 3 ? handleStartTest : 
             step === 4 ? handleStartAudit : 
             step === 5 ? handleRunImprovement : undefined
           } />
         </div>
      ) : executionError && isRateLimitError(executionError) ? (
        <div className="max-w-4xl mx-auto mb-12">
          <RateLimitState message={executionError} />
        </div>
      ) : executionError ? (
        <div className="max-w-4xl mx-auto mb-12">
          <AnalysisFailureState message={executionError} onRetry={() => setExecutionError(null)} />
        </div>
      ) : null}

      {step === 0 && (
        <AnimatedSection index={1} className="max-w-2xl mx-auto text-center py-12 sm:py-20">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-5 leading-tight">Integrated Campaign Workflow</h1>
          <div className="w-12 h-[2px] bg-[#FF0000] rounded-full mb-6 mx-auto" />
          <p className="text-gray-500 font-medium text-lg sm:text-xl leading-relaxed mb-10">
            Connect ideation, testing, and auditing into one guided process. Build and validate your marketing before you launch.
          </p>
          <div className="mb-12 text-left">
            <ExpectedOutcome
              estimatedTime="2–3 minutes"
              analyzes="Chains four tools into one guided pipeline: ideation, selection, comparison, audit."
              outcomes={['Marketing Angles (AngleMiner)', 'Hook Selection', 'Comparative Review (TestLab)', 'Conversion Audit (Conversion Doctor)']}
            />
          </div>
          {/* Same guard step 1 runs on submit, applied up front: at 0 tokens the usage modal opens here
              instead of after the user has filled in the step-1 form. */}
          <PrimaryButton size="lg" onClick={() => { if (checkTokenAvailability(TOKEN_COSTS.AngleMiner)) setStep(1); }}>Start workflow</PrimaryButton>
        </AnimatedSection>
      )}

      {step === 1 && !loading && !executionError && (
        <Card className="max-w-4xl mx-auto shadow-2xl">
          <SectionHeader title="Step 1: AngleMiner X" subtitle="Provide context to generate market triggers." />
          <form onSubmit={(e) => { e.preventDefault(); handleStartMiner(); }}>
            <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
            <div className="space-y-4">
              <Input 
                label="Product Description" 
                placeholder="What high-value offer are you positioning?" 
                value={minerParams.product} 
                onChange={e => { setMinerParams({...minerParams, product: e.target.value}); setError(null); }} 
                multiline 
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <Input 
                  label="Industry" 
                  placeholder="e.g. Fintech, EdTech" 
                  value={minerParams.industry} 
                  onChange={e => setMinerParams({...minerParams, industry: e.target.value})} 
                />
                <Input 
                  label="Target Audience" 
                  placeholder="Who are the primary decision makers?"
                  value={minerParams.target} 
                  onChange={e => setMinerParams({...minerParams, target: e.target.value})} 
                />
              </div>
            </div>
            <div className="mt-8">
              <button type="button" onClick={() => setWfAdvanced(v => !v)} className="flex items-center gap-2 text-[10px] font-bold text-gray-600 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors">
                <span className="text-base leading-none w-4 text-center">{wfAdvanced ? '−' : '+'}</span>
                Advanced context (optional)
              </button>
              <p className="mt-2 mb-6 text-[11px] font-medium text-gray-500 leading-relaxed pl-6">More context makes the generated angles sharper. All optional.</p>
              {wfAdvanced && (
                <div className="space-y-4">
                  <Input label="Competitors" placeholder="Who else competes for attention?" value={minerParams.competitors} onChange={e => setMinerParams({ ...minerParams, competitors: e.target.value })} />
                  <Input label="Buyer Objections" placeholder="Why might they hesitate?" value={minerParams.objections} onChange={e => setMinerParams({ ...minerParams, objections: e.target.value })} multiline />
                  <Input label="Brand Voice" placeholder="The tone to match" value={minerParams.brandVoice} onChange={e => setMinerParams({ ...minerParams, brandVoice: e.target.value })} />
                </div>
              )}
            </div>

            <div className="mt-10 flex flex-wrap justify-between gap-4">
              <SecondaryButton onClick={() => setStep(0)}>Cancel</SecondaryButton>
              <PrimaryButton
                type="submit"
                disabled={loading || run.inFlight || !minerParams.product}
              >
                {run.inFlight && !loading ? 'Finishing previous run…' : 'Generate angles'}
              </PrimaryButton>
            </div>
          </form>
        </Card>
      )}

      {loading && <LoadingState message="Working on it…" isTakingLong={isTakingLong} onCancel={() => { run.stopWaiting(); setLoading(false); }} />}

      {step === 2 && !loading && minerResults && (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <SectionHeader onDark title="Step 2: Selection" subtitle="Choose two or three angles to compare side by side." />
          <div className="grid grid-cols-1 gap-4">
            {[...(minerResults.angles || [])].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 6).map((angle, i) => {
              const selected = selectedAngleTexts.includes(angle.hook);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleAngleSelection(angle.hook)}
                  aria-pressed={selected}
                  className={`paper text-left p-6 sm:p-8 rounded-2xl border bg-white transition-all duration-300 ${
                    selected ? 'border-[#FF0000] shadow-xl' : 'border-gray-100 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <h4 className="text-xl font-bold text-[#0B0B0B]">{angle.title}</h4>
                    {selected && <div className="w-4 h-4 rounded-full bg-[#FF0000]" />}
                  </div>
                  <p className="text-gray-500 mt-4 leading-relaxed font-medium italic">"{angle.hook}"</p>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap justify-between gap-4 pt-8">
            <SecondaryButton tone="dark" onClick={prevStep}>Back</SecondaryButton>
            <PrimaryButton onClick={handleStartTest} disabled={loading || run.inFlight || selectedAngleTexts.length < 2}>
              Continue to comparison ({selectedAngleTexts.length}/3)
            </PrimaryButton>
          </div>
        </div>
      )}

      {step === 3 && !loading && testResults && (
        <Card className="max-w-4xl mx-auto shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <SectionHeader title="Step 3: TestLab Pro" subtitle="How the angles compare." />
          <div className="mb-10">
            <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-6 text-center">Strongest variation</p>
            <div className="p-6 sm:p-8 bg-gray-50 rounded-2xl text-center border border-gray-100 shadow-inner">
              <p className="text-2xl font-bold text-[#0B0B0B] mb-8 leading-relaxed">"{winningAngleText}"</p>
              <IntelligenceIndicator score={winningAngleScore} />
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-4 pt-8">
            <SecondaryButton onClick={prevStep}>Retest</SecondaryButton>
            <PrimaryButton onClick={nextStep}>Audit landing page</PrimaryButton>
          </div>
        </Card>
      )}

      {step === 4 && !loading && !executionError && (
        <Card className="max-w-4xl mx-auto shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <SectionHeader title="Step 4: Conversion Doctor" subtitle="Diagnose the health of existing assets." />
          <form onSubmit={(e) => { e.preventDefault(); handleStartAudit(); }}>
            <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
            <Input 
              label="Landing Page URL or Copy" 
              placeholder="Paste your full page copy or enter a live URL (https://...)" 
              value={auditInput} 
              onChange={e => { setAuditInput(e.target.value); setError(null); }} 
              multiline 
            />
            <div className="flex flex-wrap justify-between gap-4 pt-8">
              <SecondaryButton onClick={prevStep}>Back</SecondaryButton>
              <PrimaryButton type="submit" disabled={loading || run.inFlight || !auditInput}>
                Run conversion audit
              </PrimaryButton>
            </div>
          </form>
        </Card>
      )}

      {step === 5 && !loading && auditResult && (
        <Card className="max-w-4xl mx-auto shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <SectionHeader title="Step 5: Improvement Pipeline" subtitle="Combine the winning angle with the audit findings to produce final assets." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div className="p-6 sm:p-8 bg-[#FFF9F9] rounded-2xl border border-[#FF0000]/10">
              <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-6">Top conversion blockers</p>
              {(auditResult.issues || []).length === 0 ? (
                <p className="text-sm font-medium text-gray-500">No conversion blockers were flagged in the audit.</p>
              ) : (
                <ul className="space-y-4">
                  {(auditResult.issues || []).slice(0, 3).map((iss, i) => (
                    <li key={i} className="text-sm font-bold text-[#0B0B0B] flex items-start gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000] mt-1.5 shrink-0" />
                      {iss.blocker}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-6 sm:p-8 bg-gray-50 rounded-2xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">Winning angle</p>
              {winningAngleText ? (
                <p className="text-sm font-medium text-gray-600 leading-relaxed italic">"{winningAngleText}"</p>
              ) : (
                <p className="text-sm font-medium text-gray-500">No winning angle was carried through from the earlier steps.</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <PrimaryButton onClick={handleRunImprovement} disabled={loading || run.inFlight} className="w-full">
              Generate final improved assets
            </PrimaryButton>
            <button onClick={nextStep} className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest text-center transition-colors">Skip to summary</button>
          </div>
        </Card>
      )}

      {step === 6 && !loading && (
        <ResultContainer>
          <div className="max-w-5xl mx-auto space-y-12">
            {finalImprovements && (
              <div className="flex justify-center mb-12">
                <ExportControls
                  tone="dark"
                  onCopy={handleCopy}
                  onExportText={handleExportTxt}
                  onExportPDF={handleExportPDF}
                  isPro={isPro}
                  unsaved={(finalImprovements as any)?.saveError}
                />
              </div>
            )}
            {/* The headline must not claim success when there is nothing to show: "Skip to Summary"
                reaches this screen without ever generating assets. */}
            <div className="text-center mb-20 animate-in fade-in slide-in-from-top-2 duration-500">
              <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-8">Workflow summary</p>
              {finalImprovements ? (
                <>
                  <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter mb-6">Your assets are ready.</h1>
                  <p className="text-gray-500 text-lg sm:text-xl font-medium mb-12">The winning angle, the audit findings and the refined assets, in one place.</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10 text-left">
                    <Card title="Improved headline">
                      <p className="text-lg font-bold text-[#0B0B0B] leading-relaxed">"{finalImprovements.headline}"</p>
                    </Card>
                    <Card title="Call to action">
                      <p className="text-lg font-bold text-[#0B0B0B] leading-relaxed">"{finalImprovements.cta}"</p>
                    </Card>
                    <Card title="Offer messaging">
                      <p className="text-lg font-bold text-[#0B0B0B] leading-relaxed">"{finalImprovements.offer}"</p>
                    </Card>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter mb-6">Workflow complete.</h1>
                  <p className="text-gray-500 text-lg sm:text-xl font-medium mb-10 max-w-xl mx-auto leading-relaxed">
                    You skipped the final improvement step, so no refined assets were generated. Go back to
                    step 5 to produce the improved headline, CTA and offer messaging.
                  </p>
                  <button
                    onClick={() => setStep(5)}
                    className="text-[11px] font-bold text-[#FF0000] uppercase tracking-widest hover:opacity-70 transition-opacity border-b border-[#FF0000]/30 pb-1"
                  >
                    Back to step 5
                  </button>
                </>
              )}
            </div>
          </div>
        </ResultContainer>
      )}
    </div>
  );
};

export default Workflow;
