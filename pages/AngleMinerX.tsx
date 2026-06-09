
import React, { useState, useEffect } from 'react';
import AnimatedSection from '../components/AnimatedSection';
import { ExpectedOutcome } from '../components/ToolGuide';
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
import { MarketingAngle, AngleMinerResults, AngleType, ANGLE_TYPES, TOKEN_COSTS } from '../types';
import { useAuth } from '../context/AuthContext';
import { copyToClipboard, downloadAsText, printAsPDF, formatAngleMinerExport } from '../services/exportService';
import { SecurityEngine } from '../services/securityEngine';

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
        tones: selectedTones
      }, user?.uid);
      setResults(data);
      // Open the first angle type that actually has results.
      const firstType = ANGLE_TYPES.find(t => (data.angles || []).some((a: MarketingAngle) => (a.type || 'Emotional') === t)) || ANGLE_TYPES[0];
      setActiveTab(firstType);
      
      if (user) await refreshProfile();
      
    } catch (err: any) {
      console.error(err);
      setExecutionError(err.message || "The neural engine encountered an unexpected interruption. Please retry.");
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
      setExecutionError(err.message || "Failed to refine angle. Operational throttle may be active.");
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
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="text-xl font-bold text-[#0B0B0B] mb-2">{angle.title}</h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{angle.type || 'Emotional'} Angle</p>
        </div>
        <IntelligenceIndicator score={angle.score} />
      </div>
      
      <div className="space-y-8">
        <div className="p-8 bg-gray-50 rounded-[32px] border border-gray-100">
          <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-4">Core Hook</p>
          <p className="text-lg font-bold text-[#0B0B0B] leading-relaxed">
            "{angle.improved || angle.hook}"
          </p>
          {angle.improved && (
            <div className="mt-4 flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-green-500" />
              <span className="text-[9px] font-bold text-green-600 uppercase tracking-widest">Clinically Refined</span>
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Strategic Rational</p>
          <p className="text-sm font-medium text-gray-500 leading-relaxed">{angle.rational}</p>
        </div>

        <div className="flex items-center gap-6 pt-6 border-t border-gray-50">
          <button
            onClick={() => handleImprove(angle)}
            disabled={angle.improving}
            className="text-[10px] font-bold text-[#FF0000] hover:opacity-60 transition-opacity uppercase tracking-widest disabled:opacity-30"
          >
            {angle.improving ? 'Refining...' : 'Refine Angle'}
          </button>
          <button 
            onClick={() => copyToClipboard(angle.improved || angle.hook)}
            className="text-[10px] font-bold text-gray-300 hover:text-[#0B0B0B] transition-colors uppercase tracking-widest"
          >
            Copy Hook
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

      <div className="space-y-24">
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

        <AnimatedSection index={1} className="max-w-4xl mx-auto w-full">
          <Card className="shadow-2xl">
            {isSuspended && <div className="mb-12"><ErrorMessage message="SECURITY PROTOCOL ACTIVE: Account suspended due to risk threshold violations." /></div>}
            {error && <div className="mb-12"><ErrorMessage message={error} action={{ label: "Dismiss", onClick: () => setError(null) }} /></div>}
            
            {!isSuspended && (
              <form onSubmit={(e) => { e.preventDefault(); handleRun(); }}>
                <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                  <div className="md:col-span-2">
                    <Input
                      label="Product Name"
                      placeholder="e.g. MarketBrain OS"
                      value={productName}
                      onChange={(e) => { setProductName(e.target.value); setError(null); }}
                    />
                    <p className="-mt-10 mb-8 text-[11px] font-medium text-gray-600 leading-relaxed">The name of what you’re selling.<span className="text-gray-500"> e.g. MarketBrain OS.</span></p>
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      label="Product / Offer Description"
                      placeholder="Describe what you’re selling and why it matters…"
                      value={product}
                      onChange={(e) => { setProduct(e.target.value); setError(null); }}
                      multiline
                    />
                    <p className={`text-right text-[9px] font-bold uppercase tracking-widest ${product.length > MAX_INPUT_CHARS ? 'text-[#FF0000]' : 'text-gray-400'}`}>
                      {product.length} / {MAX_INPUT_CHARS} characters
                    </p>
                    <p className="mb-8 text-[11px] font-medium text-gray-600 leading-relaxed">What it does and the core benefit — the more specific, the sharper the angles.<span className="text-gray-500"> e.g. A done-for-you content marketing subscription for busy founders.</span></p>
                  </div>
                  <div>
                    <Input
                      label="Industry"
                      placeholder="e.g. SaaS, E-commerce, Real Estate"
                      value={industry}
                      onChange={(e) => { setIndustry(e.target.value); setError(null); }}
                    />
                    <p className="-mt-10 mb-8 text-[11px] font-medium text-gray-600 leading-relaxed">Your sector — shapes language and proof.<span className="text-gray-500"> e.g. B2B SaaS.</span></p>
                  </div>
                  <div>
                    <Input
                      label="Market"
                      placeholder="e.g. North America SMBs, Gen-Z creators"
                      value={market}
                      onChange={(e) => { setMarket(e.target.value); setError(null); }}
                    />
                    <p className="-mt-10 mb-8 text-[11px] font-medium text-gray-600 leading-relaxed">The segment you’re targeting.<span className="text-gray-500"> e.g. North America SMBs.</span></p>
                  </div>
                  <div>
                    <Input
                      label="Target Audience"
                      placeholder="Who is this for? Be specific."
                      value={target}
                      onChange={(e) => { setTarget(e.target.value); setError(null); }}
                    />
                    <p className="-mt-10 mb-8 text-[11px] font-medium text-gray-600 leading-relaxed">The exact person you’re speaking to.<span className="text-gray-500"> e.g. Solo founders running lean teams.</span></p>
                  </div>
                  
                  <div className="mb-12">
                    <label className="text-xs font-bold text-gray-700 mb-5 tracking-widest uppercase block">Goal</label>
                    <div className="flex flex-wrap gap-3">
                      {goals.map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGoal(g)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                            goal === g ? 'bg-[#0B0B0B] text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-12">
                    <label className="text-xs font-bold text-gray-700 mb-5 tracking-widest uppercase block">Tone Profile</label>
                    <div className="flex flex-wrap gap-3">
                      {tones.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleToggleTone(t)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                            selectedTones.includes(t) ? 'bg-[#FF0000] text-white shadow-md shadow-[#FF0000]/20' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-6 mt-8">
                  <PrimaryButton 
                    type="submit"
                    disabled={loading || !product || !target || !industry || product.length > MAX_INPUT_CHARS}
                    className="w-full"
                  >
                    {loading ? 'Mining high-performing angles...' : 'Generate Angles'}
                  </PrimaryButton>
                  <div className="flex justify-center">
                    <button 
                      type="button"
                      onClick={handleReset}
                      className="text-[10px] font-bold text-gray-300 hover:text-gray-500 uppercase tracking-widest transition-colors"
                    >
                      Reset Inputs
                    </button>
                  </div>
                </div>
              </form>
            )}
          </Card>
        </AnimatedSection>

        {loading && <LoadingState message="Evaluating market patterns..." isTakingLong={isTakingLong} onCancel={() => setLoading(false)} />}

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
            message="No angles yet." 
            submessage="Define your product and target audience to extract market intelligence." 
          />
        )}

        {results && !loading && (
          <ResultContainer>
            <div className="flex justify-between items-end mb-12">
              <SectionHeader 
                title="Strategic Angles" 
                subtitle="The neural engine has extracted the following conversion paths." 
              />
              <ExportControls 
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

            <div className="grid grid-cols-1 gap-12">
              {ANGLE_TYPES.includes(activeTab as AngleType) && (
                (() => {
                  const inType = (results.angles || []).filter(a => (a.type || 'Emotional') === activeTab);
                  if (inType.length === 0) {
                    return <p className="text-gray-500 text-sm font-medium py-8 text-center">No {activeTab} angles generated for this input.</p>;
                  }
                  return inType.map(a => renderAngleCard(a));
                })()
              )}

              {activeTab === 'Hooks & Scripts' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  {['Ads', 'Organic', 'Funnel'].map(platform => (
                    <div key={platform} className="space-y-8">
                      <h4 className="text-[10px] font-bold text-[#FF0000] uppercase tracking-[0.4em] mb-4 text-center">{platform} Hooks</h4>
                      {(results.hooks || [])
                        .filter(h => h.platform.toLowerCase().includes(platform.toLowerCase()))
                        .map((hook, i) => (
                        <Card key={i} className="!p-8 !rounded-[24px]">
                          <div className="space-y-6">
                            <div>
                              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2">Short Hook</p>
                              <p className="text-sm font-bold text-[#0B0B0B]">"{hook.short}"</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2">Expanded</p>
                              <p className="text-xs text-gray-500 leading-relaxed italic">"{hook.expanded}"</p>
                            </div>
                            <button 
                              onClick={() => copyToClipboard(hook.short + "\n" + hook.expanded)}
                              className="text-[9px] font-bold text-[#FF0000] hover:opacity-60 transition-opacity uppercase tracking-widest border-b border-[#FF0000]/10 pb-1"
                            >
                              Copy Hook
                            </button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ResultContainer>
        )}
      </div>
    </div>
  );
};

export default AngleMinerX;
