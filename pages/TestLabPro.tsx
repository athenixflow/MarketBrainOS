
import React, { useState, useEffect } from 'react';
import { 
  PageHeader, 
  Card, 
  Input, 
  PrimaryButton, 
  IntelligenceIndicator, 
  EmptyState, 
  LoadingState, 
  ResultContainer,
  SectionHeader,
  ErrorMessage,
  TokenNotice,
  TokenWarning,
  ExportControls,
  HoneypotField
} from '../components/UI';
import { runTestLabComparison, MAX_INPUT_CHARS } from '../services/geminiService';
import { TestLabResults } from '../types';
import { useAuth } from '../context/AuthContext';
import { copyToClipboard, downloadAsText, printAsPDF, formatTestLabExport } from '../services/exportService';
import { SecurityEngine } from '../services/securityEngine';

const TestLabPro: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [comparisonType, setComparisonType] = useState('Angles');
  const [variants, setVariants] = useState<string[]>(['', '']);
  const [loading, setLoading] = useState(false);
  const [isTakingLong, setIsTakingLong] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TestLabResults | null>(null);
  const [honeypotValue, setHoneypotValue] = useState('');

  const comparisonTypes = ['Angles', 'Hooks', 'Headlines', 'Ad Copy'];

  useEffect(() => {
    let timer: number;
    if (loading) {
      timer = window.setTimeout(() => setIsTakingLong(true), 8000);
    } else {
      setIsTakingLong(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const handleAddVariant = () => {
    if (variants.length < 5) {
      setVariants([...variants, '']);
    }
  };

  const handleUpdateVariant = (index: number, value: string) => {
    const newVariants = [...variants];
    newVariants[index] = value;
    setVariants(newVariants);
    setError(null);
  };

  const handleReset = () => {
    setVariants(['', '']);
    setResults(null);
    setError(null);
    setHoneypotValue('');
  };

  const getSimilarityScore = (s1: string, s2: string) => {
    const words1 = new Set(s1.toLowerCase().split(/\s+/));
    const words2 = new Set(s2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    return intersection.size / Math.max(words1.size, words2.size);
  };

  const handleRunTest = async () => {
    if (honeypotValue) {
      await SecurityEngine.handleHoneypotTrigger(profile);
      setError("Security violation detected.");
      return;
    }

    const normalizedVariants = variants
      .map(v => v.trim())
      .filter(v => v !== '');
    
    const uniqueVariants: string[] = Array.from(new Set(normalizedVariants));

    if (uniqueVariants.length < 2) {
      setError("Please provide at least two unique variations for comparison.");
      return;
    }

    if (normalizedVariants.some(v => v.length > MAX_INPUT_CHARS)) {
      setError(`A variation exceeds character limits (${MAX_INPUT_CHARS}). Please consolidate.`);
      return;
    }

    if (normalizedVariants.length !== uniqueVariants.length) {
      setError("Duplicate variations detected. Please ensure all options are distinct.");
      return;
    }

    if (profile && profile.tokens <= 0) {
      return;
    }

    // Check for extreme similarity
    for (let i = 0; i < uniqueVariants.length; i++) {
      for (let j = i + 1; j < uniqueVariants.length; j++) {
        if (getSimilarityScore(uniqueVariants[i], uniqueVariants[j]) > 0.85) {
          setError("These variations are very similar. Consider testing clearer differences for more definitive results.");
          return;
        }
      }
    }

    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const data = await runTestLabComparison(comparisonType, uniqueVariants, user?.uid);
      setResults(data);
      
      if (user) await refreshProfile();
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Stability interruption in the performance engine. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (results) {
      const text = formatTestLabExport(results);
      copyToClipboard(text);
    }
  };

  const handleExportTxt = () => {
    if (results) {
      const text = formatTestLabExport(results);
      downloadAsText("TestLab_Report", text);
    }
  };

  const handleExportPDF = () => {
    if (results) {
      const text = formatTestLabExport(results);
      printAsPDF("TestLab Pro Performance Report", text);
    }
  };

  const winningVariant = results 
    ? (results.variants || []).find(v => v.label === results.winnerLabel)
    : null;

  const isLowTokens = profile ? (profile.tier === 'free' ? profile.tokens <= 4 : profile.tokens <= 40) : false;
  const isExhausted = profile ? profile.tokens <= 0 : false;
  const isPro = profile?.tier === 'pro';

  return (
    <div className="space-y-24">
      <PageHeader 
        title="TestLab Pro: Performance Simulation" 
        subtitle="Simulate performance outcomes for headlines, hooks, and ad copy. Compare variations and predict the winning asset." 
      />

      <div className="max-w-4xl mx-auto w-full">
        <Card className="shadow-2xl">
          {error && <div className="mb-12"><ErrorMessage message={error} action={{ label: "Dismiss", onClick: () => setError(null) }} /></div>}
          
          {isLowTokens && !isExhausted && <TokenWarning />}

          {isExhausted ? (
            <TokenNotice 
              tier={profile?.tier || 'free'} 
              onUpgrade={() => window.open('https://ai.google.dev/gemini-api/docs/billing', '_blank')}
              onContinue={() => setError(null)}
            />
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); handleRunTest(); }}>
              <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
              <div className="mb-12">
                <label className="text-xs font-bold text-[#0B0B0B] mb-5 tracking-widest uppercase opacity-40 block">Comparison Type</label>
                <div className="flex flex-wrap gap-3">
                  {comparisonTypes.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setComparisonType(t)}
                      className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                        comparisonType === t ? 'bg-[#0B0B0B] text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {variants.map((v, i) => (
                  <div key={i}>
                    <Input 
                      label={`Variant ${String.fromCharCode(65 + i)}`}
                      placeholder={`Enter ${comparisonType.toLowerCase()} content...`}
                      value={v}
                      onChange={(e) => handleUpdateVariant(i, e.target.value)}
                      multiline
                    />
                    <p className={`text-right text-[9px] font-bold uppercase tracking-widest mt-[-40px] mb-8 ${v.length > MAX_INPUT_CHARS ? 'text-[#FF0000]' : 'text-gray-300'}`}>
                      {v.length} / {MAX_INPUT_CHARS}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-8 mt-8">
                <div className="flex justify-between items-center">
                  {variants.length < 5 ? (
                    <button 
                      type="button"
                      onClick={handleAddVariant}
                      className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest hover:opacity-60 transition-opacity"
                    >
                      + Add Variant
                    </button>
                  ) : <div />}
                  <button 
                    type="button"
                    onClick={handleReset}
                    className="text-[10px] font-bold text-gray-300 hover:text-gray-500 uppercase tracking-widest transition-colors"
                  >
                    Reset Test
                  </button>
                </div>

                <PrimaryButton 
                  type="submit"
                  disabled={loading || variants.filter(v => v.trim() !== '').length < 2 || variants.some(v => v.length > MAX_INPUT_CHARS)}
                  className="w-full"
                >
                  {loading ? 'Comparing variations...' : 'Run Test'}
                </PrimaryButton>
              </div>
            </form>
          )}
        </Card>
      </div>

      {loading && <LoadingState message="Predicting market performance..." isTakingLong={isTakingLong} onCancel={() => setLoading(false)} />}

      {!results && !loading && (
        <EmptyState 
          message="No comparison yet." 
          submessage="Add at least two variations to begin the predictive intelligence test." 
        />
      )}

      {results && !loading && (
        <ResultContainer>
          <div className="flex justify-between items-end mb-12">
            <SectionHeader 
              title="Performance Simulation" 
              subtitle="The following results represent predicted conversion benchmarks." 
            />
            <ExportControls 
              onCopy={handleCopy} 
              onExportText={handleExportTxt} 
              onExportPDF={handleExportPDF} 
              isPro={isPro} 
            />
          </div>

          <div className="mb-20">
            <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-[0.4em] mb-10 text-center">Winning Strategic Asset</p>
            <Card accent className="!border-[#FF0000]/10 !bg-[#FFF9F9] shadow-2xl scale-[1.02]">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h3 className="text-3xl font-bold text-[#0B0B0B] tracking-tight mb-2">
                    {winningVariant?.label} is the Projected Winner
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000] animate-pulse" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Statistical Significance: High</span>
                  </div>
                </div>
                {winningVariant && <IntelligenceIndicator score={winningVariant.score} />}
              </div>
              <div className="p-10 bg-white rounded-[32px] border border-[#FF0000]/5 text-2xl font-bold text-[#0B0B0B] leading-relaxed mb-10 shadow-inner">
                "{winningVariant?.text}"
              </div>
              <div className="p-8 bg-gray-50/50 rounded-[24px] border border-gray-100 text-gray-500 leading-relaxed font-medium whitespace-pre-wrap">
                {results.explanation}
              </div>
            </Card>
          </div>
        </ResultContainer>
      )}
    </div>
  );
};

export default TestLabPro;
