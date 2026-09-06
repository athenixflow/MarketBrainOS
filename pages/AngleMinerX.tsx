
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
  Tabs,
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
import { analyzeMarketingAngle, improveAngle, MAX_INPUT_CHARS } from '../services/geminiService';
import { MarketingAngle, AngleMinerResults, AngleType, ANGLE_TYPES, TOKEN_COSTS, AngleHook, HookChannel, HOOK_CHANNELS } from '../types';
import { useAuth } from '../context/AuthContext';
import { copyToClipboard, downloadAsText, printAsPDF, formatAngleMinerExport } from '../services/exportService';
import { SecurityEngine } from '../services/securityEngine';
import { isFixtureRequested } from '../services/devFixtures';

// Platform keywords used ONLY to rescue results saved before `channel` existed (those records carry a
// platform like "Meta"/"Email" and no channel). Anything unrecognised lands in "Other" and is still
// shown - the previous code filtered such hooks out of every column, so they vanished silently.
const LEGACY_PLATFORM_CHANNEL: Record<string, HookChannel> = {
  meta: 'Ads', facebook: 'Ads', instagram: 'Ads', google: 'Ads', ads: 'Ads', ppc: 'Ads', display: 'Ads',
  organic: 'Organic', tiktok: 'Organic', linkedin: 'Organic', youtube: 'Organic', twitter: 'Organic',
  x: 'Organic', blog: 'Organic', social: 'Organic', seo: 'Organic',
  funnel: 'Funnel', email: 'Funnel', landing: 'Funnel', checkout: 'Funnel', cart: 'Funnel', sms: 'Funnel',
};

const resolveChannel = (hook: AngleHook): HookChannel | 'Other' => {
  if (hook.channel && HOOK_CHANNELS.includes(hook.channel)) return hook.channel;
  const platform = (hook.platform || '').toLowerCase();
  if (!platform) return 'Other';
  const hit = Object.keys(LEGACY_PLATFORM_CHANNEL).find(k => platform.includes(k));
  return hit ? LEGACY_PLATFORM_CHANNEL[hit] : 'Other';
};

const bucketHooks = (hooks: AngleHook[]): Record<HookChannel | 'Other', AngleHook[]> => {
  const buckets: Record<HookChannel | 'Other', AngleHook[]> = { Ads: [], Organic: [], Funnel: [], Other: [] };
  hooks.forEach(h => buckets[resolveChannel(h)].push(h));
  return buckets;
};

// Option chips (goal / tone). Pills, per the radius rule; selected state is solid.
const chip = (active: boolean, activeCls = 'bg-[#0B0B0B] text-white') =>
  `px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${active ? activeCls : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`;

const AngleMinerX: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [product, setProduct] = useState('');
  const [industry, setIndustry] = useState('');
  const [target, setTarget] = useState('');
  const [goal, setGoal] = useState('All');
  const [selectedTones, setSelectedTones] = useState<string[]>([]);
  const [honeypotValue, setHoneypotValue] = useState('');

  const [loading, setLoading] = useState(false);
  const [isTakingLong, setIsTakingLong] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [results, setResults] = useState<AngleMinerResults | null>(null);
  const [productName, setProductName] = useState('');
  const [market, setMarket] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [objections, setObjections] = useState('');
  const [brandVoice, setBrandVoice] = useState('');
  const [proofPoints, setProofPoints] = useState('');
  const [pricePoint, setPricePoint] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(ANGLE_TYPES[0]);

  // Usage Modal State
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [usageReason, setUsageReason] = useState<'exhausted' | 'insufficient'>('exhausted');

  const tones = ['Direct', 'Emotional', 'Authority', 'Urgent', 'Educational'];
  const goals = ['Paid Ads', 'Organic Content', 'Sales Funnel', 'All'];

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
    import('../services/devFixtures').then((m) => {
      setResults(m.ANGLE_MINER_FIXTURE);
      setActiveTab(ANGLE_TYPES[0]);
    });
  }, []);

  const handleToggleTone = (tone: string) => {
    setSelectedTones(prev =>
      prev.includes(tone) ? prev.filter(t => t !== tone) : [...prev, tone]
    );
  };

  const checkTokenAvailability = (): boolean => {
    if (!profile) return false;
    if (profile.tokens === 0) {
      setUsageReason('exhausted');
      setShowUsageModal(true);
      return false;
    }
    if (profile.tier === 'free' && profile.tokens < TOKEN_COSTS.AngleMiner) {
      setUsageReason('insufficient');
      setShowUsageModal(true);
      return false;
    }
    return true;
  };

  const handleRun = async () => {
    if (honeypotValue) {
      await SecurityEngine.handleHoneypotTrigger(profile);
      setError("Security violation detected.");
      return;
    }

    if (product.length < 20) {
      setError("Provide a more detailed description to ensure high-quality strategic mining.");
      return;
    }
    if (product.length > MAX_INPUT_CHARS) {
      setError(`Description is too long (${product.length}/${MAX_INPUT_CHARS}). Please consolidate.`);
      return;
    }
    if (!target || !industry) {
      setError("Please define Industry and Target Audience for context-aware analysis.");
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
    setResults(null);
    try {
      const data = await analyzeMarketingAngle({
        productName,
        product,
        target,
        industry,
        market,
        goal,
        tones: selectedTones,
        competitors,
        objections,
        brandVoice,
        proofPoints,
        pricePoint
      }, user?.uid);
      setResults(data);
      // Open the first angle type that actually has results.
      const firstType = ANGLE_TYPES.find(t => (data.angles || []).some((a: MarketingAngle) => (a.type || 'Emotional') === t)) || ANGLE_TYPES[0];
      setActiveTab(firstType);

      if (user) await refreshProfile();

    } catch (err: any) {
      console.error(err);
      setExecutionError(err.message || "The analysis was interrupted before it finished. No tokens were deducted.");
    } finally {
      setLoading(false);
    }
  };

  const handleImprove = async (angle: MarketingAngle) => {
    if (!results) return;

    if (profile && profile.tokens <= 0) {
      setUsageReason('exhausted');
      setShowUsageModal(true);
      return;
    }

    const mark = (improving: boolean, extra: Partial<MarketingAngle> = {}) =>
      setResults(prev => prev ? {
        ...prev,
        angles: (prev.angles || []).map(a => a.hook === angle.hook ? { ...a, improving, ...extra } : a)
      } : prev);

    mark(true);

    try {
      const improvedText = await improveAngle(angle.hook, user?.uid);
      mark(false, { improved: improvedText });
      if (user) await refreshProfile();
    } catch (err: any) {
      console.error(err);
      setExecutionError(err.message || "We could not refine this angle. Please try again in a moment.");
      mark(false);
    }
  };

  const handleReset = () => {
    setProductName('');
    setProduct('');
    setIndustry('');
    setMarket('');
    setTarget('');
    setGoal('All');
    setSelectedTones([]);
    setResults(null);
    setError(null);
    setExecutionError(null);
    setHoneypotValue('');
  };

  const handleCopy = () => {
    if (results) {
      const text = formatAngleMinerExport(results);
      copyToClipboard(text);
    }
  };

  const handleExportTxt = () => {
    if (results) {
      const text = formatAngleMinerExport(results);
      downloadAsText("AngleMiner_Report", text);
    }
  };

  const handleExportPDF = () => {
    if (results) {
      const text = formatAngleMinerExport(results);
      printAsPDF("AngleMiner X Strategic Report", text);
    }
  };

  const renderAngleCard = (angle: MarketingAngle) => (
    <Card key={angle.hook} className="group hover:shadow-xl transition-all duration-500">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-[#0B0B0B] mb-2">{angle.title}</h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{angle.type || 'Emotional'} angle</p>
        </div>
        <IntelligenceIndicator score={angle.score} />
      </div>

      <div className="space-y-8">
        <div className="p-6 sm:p-8 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-4">Core hook</p>
          <p className="text-lg font-bold text-[#0B0B0B] leading-relaxed">
            "{angle.improved || angle.hook}"
          </p>
          {angle.improved && (
            <div className="mt-4"><Badge tone="green">Refined</Badge></div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Strategic rationale</p>
          <p className="text-sm font-medium text-gray-500 leading-relaxed">{angle.rational}</p>
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-6 border-t border-gray-100">
          <button
            onClick={() => handleImprove(angle)}
            disabled={angle.improving}
            className="text-[10px] font-bold text-[#FF0000] hover:opacity-60 transition-opacity uppercase tracking-widest disabled:opacity-30"
          >
            {angle.improving ? 'Refining…' : 'Refine angle'}
          </button>
          <button
            onClick={() => copyToClipboard(angle.improved || angle.hook)}
            className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] transition-colors uppercase tracking-widest"
          >
            Copy hook
          </button>
        </div>
      </div>
    </Card>
  );

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
            title="AngleMiner X: Psychological Profiling"
            subtitle="Generate marketing angles and psychological hooks. Extract audience triggers to refine your messaging positioning before deployment."
          />
          <ExpectedOutcome
            estimatedTime="30–60 seconds"
            analyzes="Maps your product and audience to high-conversion psychological angles and platform-ready hooks."
            outcomes={['Opportunity Angles', 'Emotional & Fear Angles', 'Differentiation Angles', 'Positioning Recommendations', 'Platform Hooks (Ads / Organic / Funnel)']}
          />
        </AnimatedSection>

        <AnimatedSection index={1}>
          <Card className="shadow-2xl">
            {isSuspended && <div className="mb-10"><ErrorMessage message="Your account is suspended. Analyses are disabled until an administrator restores access." /></div>}
            {error && <div className="mb-10"><ErrorMessage message={error} action={{ label: "Dismiss", onClick: () => setError(null) }} /></div>}

            {!isSuspended && (
              <form onSubmit={(e) => { e.preventDefault(); handleRun(); }}>
                <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                  <div className="md:col-span-2">
                    <Input
                      label="Product name"
                      placeholder="e.g. MarketBrain OS"
                      value={productName}
                      onChange={(e) => { setProductName(e.target.value); setError(null); }}
                      hint={<FieldHint example="MarketBrain OS.">The name of what you’re selling.</FieldHint>}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      label="Product / offer description"
                      placeholder="Describe what you’re selling and why it matters…"
                      value={product}
                      onChange={(e) => { setProduct(e.target.value); setError(null); }}
                      multiline
                      hint={
                        <>
                          <FieldHint example="A done-for-you content marketing subscription for busy founders.">What it does and the core benefit. The more specific, the sharper the angles.</FieldHint>
                          <CharCounter value={product} max={MAX_INPUT_CHARS} />
                        </>
                      }
                    />
                  </div>
                  <div>
                    <Input
                      label="Industry"
                      placeholder="e.g. SaaS, E-commerce, Real Estate"
                      value={industry}
                      onChange={(e) => { setIndustry(e.target.value); setError(null); }}
                      hint={<FieldHint example="B2B SaaS.">Your sector. It shapes language and proof.</FieldHint>}
                    />
                  </div>
                  <div>
                    <Input
                      label="Market"
                      placeholder="e.g. North America SMBs, Gen-Z creators"
                      value={market}
                      onChange={(e) => { setMarket(e.target.value); setError(null); }}
                      hint={<FieldHint example="North America SMBs.">The segment you’re targeting.</FieldHint>}
                    />
                  </div>
                  <div>
                    <Input
                      label="Target audience"
                      placeholder="Who is this for? Be specific."
                      value={target}
                      onChange={(e) => { setTarget(e.target.value); setError(null); }}
                      hint={<FieldHint example="Solo founders running lean teams.">The exact person you’re speaking to.</FieldHint>}
                    />
                  </div>

                  <div className="mb-8">
                    <p className="text-[11px] font-bold text-gray-500 mb-3 tracking-widest uppercase">Goal</p>
                    <div className="flex flex-wrap gap-2">
                      {goals.map(g => (
                        <button key={g} type="button" onClick={() => setGoal(g)} aria-pressed={goal === g} className={chip(goal === g)}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-8 md:col-span-2">
                    <p className="text-[11px] font-bold text-gray-500 mb-3 tracking-widest uppercase">Tone profile</p>
                    <div className="flex flex-wrap gap-2">
                      {tones.map(t => (
                        <button key={t} type="button" onClick={() => handleToggleTone(t)} aria-pressed={selectedTones.includes(t)} className={chip(selectedTones.includes(t), 'bg-[#FF0000] text-white shadow-md shadow-[#FF0000]/20')}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mb-10">
                  <button type="button" onClick={() => setShowAdvanced(v => !v)} aria-expanded={showAdvanced} className="flex items-center gap-2 text-[10px] font-bold text-gray-600 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors">
                    <span className="text-base leading-none w-4 text-center">{showAdvanced ? '−' : '+'}</span>
                    Advanced context (optional)
                  </button>
                  <p className="mt-2 mb-6 text-[11px] font-medium text-gray-500 leading-relaxed pl-6">The more context you add, the sharper and more tailored the angles. All optional.</p>
                  {showAdvanced && (
                    <div>
                      <Input label="Competitors" placeholder="Who else competes for this attention?" value={competitors} onChange={(e) => setCompetitors(e.target.value)}
                        hint={<FieldHint example="Asana, Monday, ClickUp.">Rivals to differentiate against.</FieldHint>} />
                      <Input label="Buyer objections" placeholder="Why might they hesitate?" value={objections} onChange={(e) => setObjections(e.target.value)} multiline
                        hint={<FieldHint example="“Too expensive”, “We already use X”.">Doubts the angles should defuse.</FieldHint>} />
                      <Input label="Brand voice" placeholder="The tone to match" value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)}
                        hint={<FieldHint example="Confident, plain-spoken, a little playful.">How the copy should sound.</FieldHint>} />
                      <Input label="Proof / credibility" placeholder="Results, stats, testimonials to lean on" value={proofPoints} onChange={(e) => setProofPoints(e.target.value)} multiline
                        hint={<FieldHint example="“Used by 4,000 teams”, “2.3× ROI in 30 days”.">Evidence the angles can use.</FieldHint>} />
                      <Input label="Price point" placeholder="e.g. $49/mo" value={pricePoint} onChange={(e) => setPricePoint(e.target.value)}
                        hint={<FieldHint example="$49/mo, or $2k one-time.">Shapes how the value is framed.</FieldHint>} />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-6 mt-8">
                  <PrimaryButton
                    type="submit"
                    disabled={loading || !product || !target || !industry || product.length > MAX_INPUT_CHARS}
                    className="w-full"
                  >
                    {loading ? 'Generating angles…' : 'Generate angles'}
                  </PrimaryButton>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors"
                    >
                      Reset inputs
                    </button>
                  </div>
                </div>
              </form>
            )}
          </Card>
        </AnimatedSection>

        {loading && <LoadingState message="Analyzing your product and audience…" isTakingLong={isTakingLong} onCancel={() => setLoading(false)} />}

        {executionError && isSystemBlockError(executionError) ? (
           <SystemBlockState message={executionError} />
        ) : executionError && isNetworkError(executionError) ? (
           <NetworkErrorState message={executionError} onRetry={handleRun} />
        ) : executionError && isRateLimitError(executionError) ? (
           <RateLimitState message={executionError} />
        ) : executionError ? (
           <AnalysisFailureState message={executionError} onRetry={() => setExecutionError(null)} />
        ) : null}

        {!results && !loading && !executionError && (
          <EmptyState
            card
            message="No angles yet"
            submessage="Describe your product and target audience above to generate angles and hooks."
          />
        )}

        {results && !loading && (
          <ResultContainer>
            <div className="flex flex-wrap justify-between items-end gap-4 mb-4">
              <SectionHeader
                onDark
                title="Strategic angles"
                subtitle="Angles ranked by predicted conversion strength, grouped by psychological type."
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

            <Tabs
              tabs={[...ANGLE_TYPES, 'Hooks & Scripts']}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            <div className="grid grid-cols-1 gap-8">
              {ANGLE_TYPES.includes(activeTab as AngleType) && (
                (() => {
                  const inType = (results.angles || []).filter(a => (a.type || 'Emotional') === activeTab);
                  if (inType.length === 0) {
                    return <EmptyState card message={`No ${activeTab} angles for this input`} submessage="Try another angle type, or add more product context and run again." />;
                  }
                  return inType.map(a => renderAngleCard(a));
                })()
              )}

              {activeTab === 'Hooks & Scripts' && (() => {
                const hooks = results.hooks || [];
                const buckets = bucketHooks(hooks);
                if (hooks.length === 0) {
                  return <EmptyState card message="No hooks were generated for this input" submessage="Run the analysis again with a goal selected to get channel-specific hooks." />;
                }
                // "Other" only appears when something genuinely failed to classify, so a hook can never
                // be silently dropped the way it was when every one was filtered out of all three columns.
                const columns: (HookChannel | 'Other')[] = [...HOOK_CHANNELS, ...(buckets.Other.length > 0 ? ['Other' as const] : [])];
                return (
                  <div className={`grid grid-cols-1 gap-8 ${columns.length > 3 ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'}`}>
                    {columns.map(channel => (
                      <div key={channel} className="space-y-6">
                        <h4 className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-4 text-center">{channel} hooks</h4>
                        {buckets[channel].length === 0 ? (
                          <p className="text-gray-500 text-xs font-medium text-center py-4">No {channel.toLowerCase()} hooks for this input.</p>
                        ) : buckets[channel].map((hook, i) => (
                          <Card key={i}>
                            <div className="space-y-6">
                              {hook.platform && <Badge tone="neutral">{hook.platform}</Badge>}
                              <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Short hook</p>
                                <p className="text-sm font-bold text-[#0B0B0B]">"{hook.short}"</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Expanded</p>
                                <p className="text-xs text-gray-500 leading-relaxed italic">"{hook.expanded}"</p>
                              </div>
                              <button
                                onClick={() => copyToClipboard(hook.short + "\n" + hook.expanded)}
                                className="text-[10px] font-bold text-[#FF0000] hover:opacity-60 transition-opacity uppercase tracking-widest border-b border-[#FF0000]/10 pb-1"
                              >
                                Copy hook
                              </button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </ResultContainer>
        )}
      </div>
    </div>
  );
};

export default AngleMinerX;
