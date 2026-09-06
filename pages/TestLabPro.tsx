
import React, { useState, useEffect } from 'react';
import AnimatedSection from '../components/AnimatedSection';
import { ExpectedOutcome, FieldHint, CharCounter } from '../components/ToolGuide';
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
  Badge,
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
import { runTestLabComparison, MAX_INPUT_CHARS } from '../services/geminiService';
import { TestLabResults, TOKEN_COSTS } from '../types';
import { useAuth } from '../context/AuthContext';
import { copyToClipboard, downloadAsText, printAsPDF, formatTestLabExport } from '../services/exportService';
import { SecurityEngine } from '../services/securityEngine';
import { isFixtureRequested } from '../services/devFixtures';

const chip = (active: boolean) =>
  `px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${active ? 'bg-[#0B0B0B] text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`;

const TestLabPro: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [comparisonType, setComparisonType] = useState('Angles');
  const [variants, setVariants] = useState<string[]>(['', '']);
  const [loading, setLoading] = useState(false);
  const [isTakingLong, setIsTakingLong] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [results, setResults] = useState<TestLabResults | null>(null);
  const [honeypotValue, setHoneypotValue] = useState('');
  const [audience, setAudience] = useState('');
  const [goal, setGoal] = useState('');
  const [channel, setChannel] = useState('');
  const [product, setProduct] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Usage Modal State
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [usageReason, setUsageReason] = useState<'exhausted' | 'insufficient'>('exhausted');

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

  // Dev-only: render a sample result (no tokens spent) for screenshots. Dead code in production.
  useEffect(() => {
    if (!isFixtureRequested()) return;
    import('../services/devFixtures').then((m) => setResults(m.TESTLAB_FIXTURE));
  }, []);

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
    setExecutionError(null);
    setHoneypotValue('');
  };

  const getSimilarityScore = (s1: string, s2: string) => {
    const words1 = new Set(s1.toLowerCase().split(/\s+/));
    const words2 = new Set(s2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    return intersection.size / Math.max(words1.size, words2.size);
  };

  const checkTokenAvailability = (): boolean => {
    if (!profile) return false;
    if (profile.tokens === 0) {
      setUsageReason('exhausted');
      setShowUsageModal(true);
      return false;
    }
    if (profile.tier === 'free' && profile.tokens < TOKEN_COSTS.TestLab) {
      setUsageReason('insufficient');
      setShowUsageModal(true);
      return false;
    }
    return true;
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

    // Token Check
    if (!checkTokenAvailability()) return;

    if (profile && profile.is_suspended) {
      setError("Account operations suspended.");
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
    setExecutionError(null);
    setResults(null);
    try {
      const data = await runTestLabComparison(comparisonType, uniqueVariants, user?.uid, { audience, goal, channel, product });
      setResults(data);

      if (user) await refreshProfile();

    } catch (err: any) {
      console.error(err);
      setExecutionError(err.message || "The comparison was interrupted before it finished. No tokens were deducted.");
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

  // Exact label equality alone was fragile: the model returns e.g. "A" while winnerLabel reads
  // "Variant A", which produced a card headed " is the Projected Winner" over an empty quote block.
  // Fall back through looser matches, then to the highest-scoring variant.
  const scoredVariants = results?.variants || [];
  const winningVariant = (() => {
    if (!results || scoredVariants.length === 0) return null;
    const target = (results.winnerLabel || '').trim().toLowerCase();
    if (target) {
      const exact = scoredVariants.find(v => (v.label || '').trim().toLowerCase() === target);
      if (exact) return exact;
      const loose = scoredVariants.find(v => {
        const label = (v.label || '').trim().toLowerCase();
        return !!label && (label.includes(target) || target.includes(label));
      });
      if (loose) return loose;
    }
    return scoredVariants.reduce((best, v) => ((v.score || 0) > (best.score || 0) ? v : best), scoredVariants[0]);
  })();

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

      <div className="space-y-16">
        <AnimatedSection index={0}>
          <PageHeader
            title="TestLab Pro: Performance Simulation"
            subtitle="Simulate performance outcomes for headlines, hooks, and ad copy. Compare variations and predict the winning asset."
          />
          <ExpectedOutcome
            estimatedTime="30–60 seconds"
            analyzes="Scores each variation and predicts the strongest performer before you spend a cent on testing."
            outcomes={['Variation Scores', 'Predicted Winner', 'Performance Rationale', 'Optimization Notes']}
          />
        </AnimatedSection>

        <AnimatedSection index={1}>
          <Card className="shadow-2xl">
            {isSuspended && <div className="mb-10"><ErrorMessage message="Your account is suspended. Analyses are disabled until an administrator restores access." /></div>}
            {error && <div className="mb-10"><ErrorMessage message={error} action={{ label: "Dismiss", onClick: () => setError(null) }} /></div>}

            {!isSuspended && (
              <form onSubmit={(e) => { e.preventDefault(); handleRunTest(); }}>
                <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
                <div className="mb-8">
                  <p className="text-[11px] font-bold text-gray-500 mb-3 tracking-widest uppercase">Comparison type</p>
                  <div className="flex flex-wrap gap-2">
                    {comparisonTypes.map(t => (
                      <button key={t} type="button" onClick={() => setComparisonType(t)} aria-pressed={comparisonType === t} className={chip(comparisonType === t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="mb-8 text-[11px] font-medium text-gray-600 leading-relaxed">Paste 2 to 5 versions you want to test against each other. We predict a winner and explain why.<span className="text-gray-500"> e.g. two headline options, or two ad primary texts.</span></p>

                <div>
                  {variants.map((v, i) => (
                    <Input
                      key={i}
                      label={`Variant ${String.fromCharCode(65 + i)}`}
                      placeholder={`Enter ${comparisonType.toLowerCase()} content…`}
                      value={v}
                      onChange={(e) => handleUpdateVariant(i, e.target.value)}
                      multiline
                      hint={<CharCounter value={v} max={MAX_INPUT_CHARS} />}
                    />
                  ))}
                </div>

                <div className="mt-2 mb-2">
                  <button type="button" onClick={() => setShowAdvanced(v => !v)} aria-expanded={showAdvanced} className="flex items-center gap-2 text-[10px] font-bold text-gray-600 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors">
                    <span className="text-base leading-none w-4 text-center">{showAdvanced ? '−' : '+'}</span>
                    Advanced context (optional)
                  </button>
                  <p className="mt-2 mb-6 text-[11px] font-medium text-gray-500 leading-relaxed pl-6">Context makes the prediction sharper and the explanation more useful. All optional.</p>
                  {showAdvanced && (
                    <div>
                      <Input label="Target audience" placeholder="Who will see these?" value={audience} onChange={(e) => setAudience(e.target.value)}
                        hint={<FieldHint example="Cold Meta traffic, first-time buyers.">Who you’re testing against.</FieldHint>} />
                      <Input label="Desired action" placeholder="What should a winner drive?" value={goal} onChange={(e) => setGoal(e.target.value)}
                        hint={<FieldHint example="Click through to the offer.">The action a winning variant should produce.</FieldHint>} />
                      <Input label="Channel / placement" placeholder="Where these run" value={channel} onChange={(e) => setChannel(e.target.value)}
                        hint={<FieldHint example="Meta feed, email subject line.">The placement and its constraints.</FieldHint>} />
                      <Input label="Product / offer" placeholder="What’s being promoted" value={product} onChange={(e) => setProduct(e.target.value)}
                        hint={<FieldHint example="A $29/mo analytics tool.">What the variants are selling.</FieldHint>} />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-8 mt-8">
                  <div className="flex flex-wrap justify-between items-center gap-4">
                    {variants.length < 5 ? (
                      <button
                        type="button"
                        onClick={handleAddVariant}
                        className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest hover:opacity-60 transition-opacity"
                      >
                        + Add variant
                      </button>
                    ) : <div />}
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors"
                    >
                      Reset test
                    </button>
                  </div>

                  <PrimaryButton
                    type="submit"
                    disabled={loading || variants.filter(v => v.trim() !== '').length < 2 || variants.some(v => v.length > MAX_INPUT_CHARS)}
                    className="w-full"
                  >
                    {loading ? 'Comparing variations…' : 'Run test'}
                  </PrimaryButton>
                </div>
              </form>
            )}
          </Card>
        </AnimatedSection>

        {loading && <LoadingState message="Scoring your variations…" isTakingLong={isTakingLong} onCancel={() => setLoading(false)} />}

        {executionError && isSystemBlockError(executionError) ? (
           <SystemBlockState message={executionError} />
        ) : executionError && isNetworkError(executionError) ? (
           <NetworkErrorState message={executionError} onRetry={handleRunTest} />
        ) : executionError && isRateLimitError(executionError) ? (
           <RateLimitState message={executionError} />
        ) : executionError ? (
           <AnalysisFailureState message={executionError} onRetry={() => setExecutionError(null)} />
        ) : null}

        {!results && !loading && !executionError && (
          <EmptyState
            card
            message="No comparison yet"
            submessage="Add at least two variations above and run the test to see a predicted winner."
          />
        )}

        {results && !loading && (
          <ResultContainer>
            <div className="flex flex-wrap justify-between items-end gap-4 mb-4">
              <SectionHeader
                onDark
                title="Performance simulation"
                subtitle="Predicted performance for each variation, and why the winner wins."
                className="mb-0"
              />
              <ExportControls
                tone="dark"
                onCopy={handleCopy}
                onExportText={handleExportTxt}
                onExportPDF={handleExportPDF}
                isPro={isPro}
              />
            </div>

            {/* Heading and body are guarded together: an unmatched winner used to leave the heading
                painted over an empty quote block. */}
            {winningVariant && (
              <div className="mb-12">
                <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-6 text-center">Predicted winner</p>
                <Card accent className="!border-[#FF0000]/10 !bg-[#FFF9F9] shadow-2xl">
                  <div className="flex flex-wrap justify-between items-start gap-6 mb-8">
                    <div className="min-w-0">
                      <h3 className="text-2xl sm:text-3xl font-bold text-[#0B0B0B] tracking-tight mb-2">
                        {winningVariant.label || 'Top variant'} is the projected winner
                      </h3>
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#FF0000]" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Highest projected performance</span>
                      </div>
                    </div>
                    <IntelligenceIndicator score={winningVariant.score} />
                  </div>
                  {winningVariant.text && (
                    <div className="p-6 sm:p-8 bg-white rounded-2xl border border-[#FF0000]/5 text-xl sm:text-2xl font-bold text-[#0B0B0B] leading-relaxed mb-8 shadow-inner">
                      "{winningVariant.text}"
                    </div>
                  )}
                  {results.explanation && (
                    <div className="p-6 bg-gray-50/50 rounded-2xl border border-gray-100 text-gray-500 leading-relaxed font-medium whitespace-pre-wrap">
                      {results.explanation}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* Per-variant scores: promised by the "Variation Scores" deliverable and present in the
                data (and in the export), but never rendered anywhere until now. */}
            {scoredVariants.length > 0 && (
              <div className="mb-12">
                <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-6 text-center">All variation scores</p>
                <div className="space-y-4">
                  {[...scoredVariants].sort((a, b) => (b.score || 0) - (a.score || 0)).map((v, i) => {
                    const isWinner = v === winningVariant;
                    return (
                      <Card key={i} className={isWinner ? '!border-[#FF0000]/20' : ''}>
                        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <p className="text-sm font-bold text-[#0B0B0B]">{v.label || `Variant ${i + 1}`}</p>
                            {isWinner && <Badge tone="red">Winner</Badge>}
                          </div>
                          <span className="text-sm font-black text-[#0B0B0B] tabular-nums">{v.score ?? '–'}<span className="text-gray-400 font-bold">/100</span></span>
                        </div>
                        {v.text && <p className="text-sm text-gray-600 leading-relaxed">"{v.text}"</p>}
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {scoredVariants.length === 0 && (
              <EmptyState
                card
                message="No variations were scored for this input"
                submessage="Try rerunning with more distinct variants."
              />
            )}
          </ResultContainer>
        )}
      </div>
    </div>
  );
};

export default TestLabPro;
