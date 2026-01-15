
import React, { useState, useEffect } from 'react';
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
  TokenNotice,
  TokenWarning,
  ExportControls,
  HoneypotField
} from '../components/UI';
import { 
  analyzeMarketingAngle, 
  runTestLabComparison, 
  auditConversion, 
  improveWorkflowAssets 
} from '../services/geminiService';
import { AngleMinerResults, TestLabResults, AuditResult } from '../types';
import { useAuth } from '../context/AuthContext';
import { copyToClipboard, downloadAsText, printAsPDF, formatWorkflowExport } from '../services/exportService';
import { SecurityEngine } from '../services/securityEngine';

const Workflow: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [isTakingLong, setIsTakingLong] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [honeypotValue, setHoneypotValue] = useState('');

  // Step 1: AngleMiner X
  const [minerParams, setMinerParams] = useState({ product: '', industry: '', target: '', goal: 'All', tones: [] as string[] });
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
      timer = window.setTimeout(() => setIsTakingLong(true), 9000);
    } else {
      setIsTakingLong(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const nextStep = () => {
    setStep(s => s + 1);
    setError(null);
  };
  const prevStep = () => {
    setStep(s => s - 1);
    setError(null);
  };

  const checkHoneypot = async () => {
    if (honeypotValue) {
      await SecurityEngine.handleHoneypotTrigger(profile);
      setError("Security violation detected.");
      return true;
    }
    return false;
  };

  const handleStartMiner = async () => {
    if (await checkHoneypot()) return;
    if (minerParams.product.length < 20) {
      setError("Please add a bit more detail to the product description.");
      return;
    }

    if (profile && profile.tokens <= 0) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await analyzeMarketingAngle(minerParams); // No user ID passed to prevent deduction in preview/step 1 if desired, but Workflow logic usually deducts at end? 
      // Actually, per previous implementation, Workflow deducts at end. 
      // So we do NOT pass userId here if we want to defer deduction, or we do if we want step-by-step.
      // The original code only deducted at step 5.
      // So here we pass undefined for userId to skip persistence/deduction until the final step?
      // Wait, original code called analyzeMarketingAngle then nextStep. No persistence there.
      // So we keep it as is: pass undefined userId.
      setMinerResults(data);
      nextStep();
    } catch (err: any) {
      setError(err.message || "Generating angles failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartTest = async () => {
    if (await checkHoneypot()) return;
    if (selectedAngleTexts.length < 2) {
      setError("Please select at least 2 angles.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Same logic: Step-by-step in workflow was transient in original code.
      const data = await runTestLabComparison('Angles', selectedAngleTexts); 
      setTestResults(data);
      nextStep();
    } catch (err: any) {
      setError(err.message || "Simulation error.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartAudit = async () => {
    if (await checkHoneypot()) return;
    if (!auditInput) return;
    setLoading(true);
    setError(null);
    try {
      // Transient
      const data = await auditConversion(auditInput, 'Landing Page');
      setAuditResult(data);
      nextStep();
    } catch (err: any) {
      setError(err.message || "Audit engine failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunImprovement = async () => {
    if (await checkHoneypot()) return;
    if (!testResults || !auditResult) return;
    const winner = (testResults.variants || []).find(v => v.label === testResults.winnerLabel);
    if (!winner) {
      setError("Validation Error: No winning variant found in test results.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const issues = (auditResult.issues || []).map(i => i.blocker);
      
      // THIS IS THE FINAL STEP where persistence happens in Workflow
      // We pass userId here to trigger the transaction
      const data = await improveWorkflowAssets(
        winner.text, 
        issues, 
        user?.uid,
        winner.score,
        auditResult.score
      );
      
      setFinalImprovements(data);
      
      if (user) await refreshProfile();
      
      nextStep();
    } catch (err: any) {
      setError(err.message || "Asset refinement failed.");
    } finally {
      setLoading(false);
    }
  };

  const toggleAngleSelection = (text: string) => {
    setSelectedAngleTexts(prev => 
      prev.includes(text) ? prev.filter(t => t !== text) : [...prev, text].slice(0, 3)
    );
  };

  const winningAngleText = (testResults?.variants || []).find(v => v.label === testResults?.winnerLabel)?.text;
  const winningAngleScore = (testResults?.variants || []).find(v => v.label === testResults?.winnerLabel)?.score || 0;

  const handleCopy = () => {
    if (winningAngleText && auditResult && finalImprovements) {
      const text = formatWorkflowExport({
        angle: winningAngleText,
        testScore: winningAngleScore,
        conversionScore: auditResult.score,
        finalAssets: finalImprovements
      });
      copyToClipboard(text);
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
    if (winningAngleText && auditResult && finalImprovements) {
      const text = formatWorkflowExport({
        angle: winningAngleText,
        testScore: winningAngleScore,
        conversionScore: auditResult.score,
        finalAssets: finalImprovements
      });
      printAsPDF("MarketBrainOS Workflow Summary", text);
    }
  };

  const isLowTokens = profile ? (profile.tier === 'free' ? profile.tokens <= 4 : profile.tokens <= 40) : false;
  const isExhausted = profile ? profile.tokens <= 0 : false;
  const isPro = profile?.tier === 'pro';

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-6">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 py-2 bg-[#121212] rounded-full border border-gray-900">
            Step {Math.max(1, step)} of 6
          </div>
          <div className="h-1 w-48 bg-gray-900 rounded-full overflow-hidden">
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
            Exit Workflow
          </button>
        )}
      </div>

      {error && <div className="max-w-4xl mx-auto"><ErrorMessage message={error} action={{ label: "Retry", onClick: () => setError(null) }} /></div>}

      {isLowTokens && !isExhausted && step > 0 && step < 6 && <TokenWarning />}

      {step === 0 && (
        <div className="max-w-2xl mx-auto text-center py-24 animate-in fade-in zoom-in duration-1000">
          <PageHeader 
            title="Integrated Campaign Workflow" 
            subtitle="Connect ideation, testing, and auditing into one seamless executive process. Build and validate your marketing before you launch." 
          />
          {isExhausted ? (
            <TokenNotice 
              tier={profile?.tier || 'free'} 
              onUpgrade={() => window.open('https://ai.google.dev/gemini-api/docs/billing', '_blank')}
            />
          ) : (
            <PrimaryButton onClick={() => setStep(1)} className="!px-16 !py-6 !text-lg">Start Workflow</PrimaryButton>
          )}
        </div>
      )}

      {step === 1 && !loading && (
        <Card className="max-w-4xl mx-auto shadow-2xl">
          <SectionHeader title="Step 1: AngleMiner X" subtitle="Provide context to generate market triggers." />
          <form onSubmit={(e) => { e.preventDefault(); handleStartMiner(); }}>
            <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
            {isExhausted ? (
              <TokenNotice 
                tier={profile?.tier || 'free'} 
                onUpgrade={() => window.open('https://ai.google.dev/gemini-api/docs/billing', '_blank')}
              />
            ) : (
              <>
                <div className="space-y-4">
                  <Input 
                    label="Product Description" 
                    placeholder="What high-value offer are you positioning?" 
                    value={minerParams.product} 
                    onChange={e => { setMinerParams({...minerParams, product: e.target.value}); setError(null); }} 
                    multiline 
                  />
                  <div className="grid grid-cols-2 gap-8">
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
                <div className="mt-12 flex justify-between">
                  <SecondaryButton onClick={() => setStep(0)}>Cancel</SecondaryButton>
                  <PrimaryButton 
                    type="submit"
                    disabled={loading || !minerParams.product}
                  >
                    Generate Angles
                  </PrimaryButton>
                </div>
              </>
            )}
          </form>
        </Card>
      )}

      {loading && <LoadingState message="Neural engine processing active..." isTakingLong={isTakingLong} onCancel={() => setLoading(false)} />}

      {step === 2 && !loading && minerResults && (
        <div className="max-w-4xl mx-auto space-y-12 animate-in slide-in-from-bottom-8 duration-700">
          <SectionHeader title="Step 2: Selection" subtitle="Choose hooks to enter performance simulator (Max 3)." />
          <div className="grid grid-cols-1 gap-6">
            {(minerResults.prime || []).map((angle, i) => (
              <button 
                key={i} 
                onClick={() => toggleAngleSelection(angle.hook)}
                className={`text-left p-10 rounded-[32px] border transition-all duration-500 ${
                  selectedAngleTexts.includes(angle.hook) 
                    ? 'bg-white border-[#FF0000] shadow-xl' 
                    : 'bg-white/50 border-gray-100 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex justify-between items-center">
                  <h4 className="text-xl font-bold text-[#0B0B0B]">{angle.title}</h4>
                  {selectedAngleTexts.includes(angle.hook) && (
                    <div className="w-4 h-4 rounded-full bg-[#FF0000]" />
                  )}
                </div>
                <p className="text-gray-500 mt-4 leading-relaxed font-medium italic">"{angle.hook}"</p>
              </button>
            ))}
          </div>
          <div className="flex justify-between pt-12">
            <SecondaryButton onClick={prevStep}>Back</SecondaryButton>
            <PrimaryButton onClick={handleStartTest} disabled={selectedAngleTexts.length < 2}>
              Continue to Simulator ({selectedAngleTexts.length}/3)
            </PrimaryButton>
          </div>
        </div>
      )}

      {step === 3 && !loading && testResults && (
        <Card className="max-w-4xl mx-auto shadow-2xl animate-in slide-in-from-bottom-8 duration-700">
          <SectionHeader title="Step 3: TestLab Pro" subtitle="Performance prediction results." />
          <div className="mb-12">
            <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-6 text-center">Projected Performance Winner</p>
            <div className="p-10 bg-gray-50 rounded-[40px] text-center border border-gray-100 shadow-inner">
              <p className="text-2xl font-bold text-[#0B0B0B] mb-8 leading-relaxed">"{winningAngleText}"</p>
              <IntelligenceIndicator score={winningAngleScore} />
            </div>
          </div>
          <div className="flex justify-between pt-12">
            <SecondaryButton onClick={prevStep}>Retest</SecondaryButton>
            <PrimaryButton onClick={nextStep}>Audit Landing Page</PrimaryButton>
          </div>
        </Card>
      )}

      {step === 4 && !loading && (
        <Card className="max-w-4xl mx-auto shadow-2xl animate-in slide-in-from-bottom-8 duration-700">
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
            <div className="flex justify-between pt-12">
              <SecondaryButton onClick={prevStep}>Back</SecondaryButton>
              <PrimaryButton type="submit" disabled={loading || !auditInput}>
                Run Clinical Audit
              </PrimaryButton>
            </div>
          </form>
        </Card>
      )}

      {step === 5 && !loading && auditResult && (
        <Card className="max-w-4xl mx-auto shadow-2xl animate-in slide-in-from-bottom-8 duration-700">
          <SectionHeader title="Step 5: Improvement Pipeline" subtitle="Synthesizing test results with clinical data." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="p-10 bg-[#FFF9F9] rounded-[40px] border border-[#FF0000]/10">
              <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-6">Top Diagnostic Issues</p>
              <ul className="space-y-4">
                {(auditResult.issues || []).slice(0, 3).map((iss, i) => (
                  <li key={i} className="text-sm font-bold text-[#0B0B0B] flex items-start gap-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000] mt-1.5 shrink-0" />
                    {iss.blocker}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-10 bg-gray-50 rounded-[40px] border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">Strategic Winning Foundation</p>
              <p className="text-sm font-medium text-gray-600 leading-relaxed italic">
                "{winningAngleText}"
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <PrimaryButton onClick={handleRunImprovement} disabled={loading} className="w-full">
              Generate final improved assets
            </PrimaryButton>
            <button onClick={nextStep} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Skip to Summary</button>
          </div>
        </Card>
      )}

      {step === 6 && !loading && (
        <ResultContainer>
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="flex justify-center mb-12">
              <ExportControls 
                onCopy={handleCopy} 
                onExportText={handleExportTxt} 
                onExportPDF={handleExportPDF} 
                isPro={isPro} 
              />
            </div>
            <div className="text-center mb-20 animate-in fade-in slide-in-from-top-4 duration-1000">
              <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-[0.5em] mb-8">Executive Intelligence Summary</p>
              <h1 className="text-5xl font-black text-white tracking-tighter mb-6">Strategic Assets Ready.</h1>
              <p className="text-gray-500 text-xl font-medium mb-12">Your strategy has been validated and clinically refined.</p>
              
              {finalImprovements && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-left">
                  <Card title="Improved Headline">
                    <p className="text-lg font-bold text-[#0B0B0B] leading-relaxed">"{finalImprovements.headline}"</p>
                  </Card>
                  <Card title="Benefit CTA">
                    <p className="text-lg font-bold text-[#0B0B0B] leading-relaxed">"{finalImprovements.cta}"</p>
                  </Card>
                  <Card title="Offer Messaging">
                    <p className="text-lg font-bold text-[#0B0B0B] leading-relaxed">"{finalImprovements.offer}"</p>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </ResultContainer>
      )}
    </div>
  );
};

export default Workflow;
