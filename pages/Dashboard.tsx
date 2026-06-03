
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  PageHeader, Card, PrimaryButton, UpgradeCard, LockedFeatureCard,
  TokenStatusBanner, TokenHistoryModal, PaymentHistoryModal, EmptyState,
} from '../components/UI';
import AnimatedSection from '../components/AnimatedSection';
import SubscriptionPanel from '../components/SubscriptionPanel';
import { useAuth } from '../context/AuthContext';
import { useScope } from '../context/ScopeContext';
import {
  callConfirmTopUp, replayOnboarding, createNotification,
  getUserToolAnalyses, getReportsForScope, getUserActionLogs,
  ToolAnalysisRecord,
} from '../services/persistenceService';
import { Report, ActionLogEntry } from '../types';
import { NAV_SUITES, TOOL_CONFIG_LIST, getToolMeta } from '../config/toolConfigs';
import { canSeeFeature, tierAtLeast } from '../config/access';

// Resolve a server module key to a friendly tool label (covers generic + bespoke modules).
const moduleLabel = (m: string): string =>
  getToolMeta(m)?.label || m.replace(/_.*/, '').replace(/([A-Z])/g, ' $1').trim() || m;

// Small stat tile used across the metrics rows.
const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <Card className="!p-8">
    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-4">{label}</p>
    <p className="text-4xl font-black text-[#0B0B0B] leading-none">{value}</p>
    {hint && <p className="text-[11px] font-medium text-gray-400 mt-3">{hint}</p>}
  </Card>
);

const Dashboard: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { memberships } = useScope();
  const accessCtx = { profile, memberships };

  const [topUpStatus, setTopUpStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showReceipts, setShowReceipts] = useState(false);

  // Intelligence data (personal scope — the user's own profile).
  const [analyses, setAnalyses] = useState<ToolAnalysisRecord[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [logs, setLogs] = useState<ActionLogEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user) return;
    setLoadingData(true);
    Promise.all([
      getUserToolAnalyses(user.uid),
      getReportsForScope(user.uid, { level: 'personal' }),
      getUserActionLogs(user.uid),
    ])
      .then(([a, r, l]) => {
        if (!active) return;
        setAnalyses(a); setReports(r); setLogs(l);
      })
      .catch(console.error)
      .finally(() => { if (active) setLoadingData(false); });
    return () => { active = false; };
  }, [user]);

  const handleReplayTour = async () => {
    if (!user) return;
    await replayOnboarding(user.uid);
    await refreshProfile();
  };

  const handleTopUp = async () => {
    if (profile?.tier !== 'pro') return;
    setTopUpStatus('processing');
    setFeedbackMsg('');
    try {
      const mockPaymentRef = `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await callConfirmTopUp(mockPaymentRef);
      await refreshProfile();
      setTopUpStatus('success');
      setFeedbackMsg('100 tokens credited successfully.');
      if (user) createNotification(user.uid, 'Token', 'Top-up successful', '100 tokens have been added to your balance.');
      setTimeout(() => { setTopUpStatus('idle'); setFeedbackMsg(''); }, 4000);
    } catch (e: any) {
      setTopUpStatus('error');
      setFeedbackMsg(e.message || 'Transaction failed. No tokens charged.');
    }
  };

  // --- Derived intelligence (client-side rollups; no backend work) ---
  const metrics = useMemo(() => {
    const moduleCounts = new Map<string, number>();
    analyses.forEach(a => moduleCounts.set(a.module, (moduleCounts.get(a.module) || 0) + 1));
    const mostUsed = [...moduleCounts.entries()]
      .map(([module, count]) => ({ module, count, label: moduleLabel(module) }))
      .sort((x, y) => y.count - x.count);

    const tokensUsed = logs.reduce(
      (n, l) => n + (l.status !== 'failed_refunded' && l.tokens_used ? l.tokens_used : 0), 0);

    const insightsGenerated = analyses.reduce(
      (n, a) => n + (Array.isArray(a.result?.sections) ? a.result.sections.length : 0), 0);

    const usedModules = new Set(analyses.map(a => a.module));
    const unusedTool = TOOL_CONFIG_LIST.find(t => !usedModules.has(t.module));

    const topModule = mostUsed[0]?.module;
    const recommended = topModule
      ? (TOOL_CONFIG_LIST.find(t => t.worksWith.includes(topModule) && !usedModules.has(t.module))
         || TOOL_CONFIG_LIST.find(t => t.worksWith.includes(topModule)))
      : TOOL_CONFIG_LIST[0];

    // Latest "Recommendations" section, if any, from the most recent analysis.
    const latest = analyses[0];
    const recSection = Array.isArray(latest?.result?.sections)
      ? latest.result.sections.find((s: any) => /recommend/i.test(s.title))
      : null;

    return { mostUsed, tokensUsed, insightsGenerated, unusedTool, recommended, recSection, topLabel: mostUsed[0]?.label };
  }, [analyses, logs]);

  const recentActivity = useMemo(() => {
    const items: { kind: string; label: string; ts: number }[] = [];
    analyses.slice(0, 6).forEach(a => items.push({ kind: 'Analysis', label: moduleLabel(a.module), ts: new Date(a.timestamp || 0).getTime() }));
    reports.slice(0, 6).forEach(r => items.push({ kind: 'Report', label: r.title || 'Report', ts: r.created_at ? new Date(r.created_at).getTime() : 0 }));
    return items.sort((a, b) => b.ts - a.ts).slice(0, 6);
  }, [analyses, reports]);

  const displayName = profile?.email ? profile.email.split('@')[0] : 'there';
  const tier = profile?.tier || 'free';
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const hasData = analyses.length > 0 || reports.length > 0;

  // Next collaboration tier the user has NOT unlocked yet → upsell card.
  const lockedFeature =
    !canSeeFeature('teamWorkspace', accessCtx) ? { title: 'Team Workspace', planLabel: 'Team', description: 'Unlock shared workspaces, member roles, and team analytics to collaborate on intelligence.' }
    : !canSeeFeature('agencyHub', accessCtx) ? { title: 'Agency Hub', planLabel: 'Agency', description: 'Manage multiple clients with isolated workspaces, assignments, and per-client reporting.' }
    : !canSeeFeature('enterpriseSuite', accessCtx) ? { title: 'Enterprise Suite', planLabel: 'Enterprise', description: 'Aggregate organization-wide intelligence with health scores, forecasts, and executive briefings.' }
    : null;

  const scrollToTools = () => document.getElementById('tools-section')?.scrollIntoView({ behavior: 'smooth' });

  // Gated quick actions (hidden = hidden everywhere — same access context as the sidebar).
  const quickActions: { label: string; onClick?: () => void; to?: string; primary?: boolean }[] = [
    { label: 'Run New Analysis', onClick: scrollToTools, primary: true },
    { label: 'View History', to: '/history' },
    { label: 'Open Reports', to: '/reports' },
    ...(tier === 'pro' ? [{ label: 'Buy Tokens', onClick: handleTopUp }] : []),
    ...(!tierAtLeast(tier, 'team') ? [{ label: 'Upgrade Plan', to: '/pricing' }] : []),
  ];

  return (
    <div className="space-y-12">
      {profile && <TokenStatusBanner tier={profile.tier} tokens={profile.tokens} />}
      {showHistory && <TokenHistoryModal onClose={() => setShowHistory(false)} />}
      {showReceipts && <PaymentHistoryModal onClose={() => setShowReceipts(false)} />}

      <div className="space-y-20">
        {/* ===================== ROW 1 — WELCOME ===================== */}
        <AnimatedSection index={0}>
          <PageHeader
            title={`Welcome back, ${displayName}`}
            subtitle="Your command center for predictive marketing intelligence — track activity, surface insights, and launch your next analysis."
          />

          <Card className="!p-10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-8 bg-[#121212] border-gray-900">
            <div className="flex flex-wrap items-center gap-x-12 gap-y-6">
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">Plan</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-white">{tierLabel}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${tier === 'free' ? 'bg-gray-700 text-white' : 'bg-[#FF0000] text-white'}`}>
                    {tier === 'free' ? 'Free' : 'Active'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">Token Balance</p>
                <span className={`text-2xl font-black ${(profile?.tokens || 0) === 0 ? 'text-red-500' : 'text-white'}`}>{profile?.tokens ?? 0}</span>
              </div>
              <div className="hidden sm:flex gap-8">
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">Analyses</p>
                  <span className="text-2xl font-black text-white">{analyses.length}</span>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">Reports</p>
                  <span className="text-2xl font-black text-white">{reports.length}</span>
                </div>
              </div>
            </div>

            {/* Quick actions (gated) */}
            <div className="flex flex-wrap gap-3 lg:justify-end">
              {quickActions.map((qa) => {
                const cls = qa.primary
                  ? 'px-6 py-3 rounded-xl bg-[#FF0000] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#D40000] transition-all'
                  : 'px-6 py-3 rounded-xl bg-white/5 border border-gray-800 text-gray-300 text-[10px] font-bold uppercase tracking-widest hover:text-white hover:border-gray-600 transition-all';
                return qa.to
                  ? <Link key={qa.label} to={qa.to} className={cls}>{qa.label}</Link>
                  : <button key={qa.label} onClick={qa.onClick} className={cls}>{qa.label}</button>;
              })}
            </div>
          </Card>

          {/* Top-up feedback (pro) */}
          {feedbackMsg && (
            <p className={`mt-4 text-[10px] font-bold uppercase tracking-widest ${topUpStatus === 'error' ? 'text-red-500' : 'text-green-500'}`}>{feedbackMsg}</p>
          )}
          <div className="mt-4 flex gap-6">
            <button onClick={() => setShowHistory(true)} className="text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-colors">View Usage History</button>
            {tier === 'pro' && <button onClick={() => setShowReceipts(true)} className="text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-colors">View Receipts</button>}
            <button onClick={handleReplayTour} className="text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-colors">Replay Tour</button>
          </div>
        </AnimatedSection>

        {/* ===================== ROW 2 — AI INSIGHTS ===================== */}
        <AnimatedSection as="section" index={1}>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.4em] mb-6">AI Insights</h2>
          {hasData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card accent className="!p-8">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-3">Most Active Tool</p>
                <p className="text-xl font-bold text-[#0B0B0B] tracking-tight">{metrics.topLabel || '—'}</p>
                <p className="text-[11px] text-gray-400 mt-2 font-medium">Your most-used analysis so far.</p>
              </Card>
              <Card className="!p-8">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-3">Recommended Next</p>
                {metrics.recommended ? (
                  <Link to={`/${metrics.recommended.slug}`} className="text-xl font-bold text-[#0B0B0B] tracking-tight hover:text-[#FF0000] transition-colors">{metrics.recommended.navLabel}</Link>
                ) : <p className="text-xl font-bold text-[#0B0B0B]">—</p>}
                <p className="text-[11px] text-gray-400 mt-2 font-medium">Pairs well with your recent work.</p>
              </Card>
              <Card className="!p-8">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-3">Unused Opportunity</p>
                {metrics.unusedTool ? (
                  <Link to={`/${metrics.unusedTool.slug}`} className="text-xl font-bold text-[#0B0B0B] tracking-tight hover:text-[#FF0000] transition-colors">{metrics.unusedTool.navLabel}</Link>
                ) : <p className="text-xl font-bold text-[#0B0B0B]">All tools explored</p>}
                <p className="text-[11px] text-gray-400 mt-2 font-medium">A tool you haven't tried yet.</p>
              </Card>
            </div>
          ) : (
            <Card>
              <EmptyState
                message="Run your first analysis to begin building your business intelligence profile"
                submessage="As you use the tools, this space fills with personalized recommendations and strategic suggestions."
              />
              <div className="flex justify-center">
                <button onClick={scrollToTools} className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest hover:opacity-60 transition-opacity border-b border-[#FF0000]/20 pb-1">Browse tools →</button>
              </div>
            </Card>
          )}
        </AnimatedSection>

        {/* ===================== ROW 3 — PERFORMANCE METRICS ===================== */}
        <AnimatedSection as="section" index={2}>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.4em] mb-6">Performance Metrics</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <Stat label="Analyses Generated" value={analyses.length} />
            <Stat label="Reports Generated" value={reports.length} />
            <Stat label="Tokens Used" value={metrics.tokensUsed} />
            <Stat label="Insights Generated" value={metrics.insightsGenerated} />
          </div>
        </AnimatedSection>

        {/* ===================== ROW 4 — BI SUMMARY ===================== */}
        <AnimatedSection as="section" index={3}>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.4em] mb-6">Business Intelligence Summary</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="!p-8" title="Most Used Tools">
              {metrics.mostUsed.length === 0 ? (
                <p className="text-sm text-gray-400 font-medium py-8 text-center">No tool usage yet.</p>
              ) : (
                <div className="space-y-4">
                  {metrics.mostUsed.slice(0, 5).map((m) => {
                    const pct = Math.round((m.count / metrics.mostUsed[0].count) * 100);
                    return (
                      <div key={m.module}>
                        <div className="flex justify-between text-xs font-bold text-[#0B0B0B] mb-1.5">
                          <span>{m.label}</span><span className="text-gray-400">{m.count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full bg-[#FF0000] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
            <Card className="!p-8" title="Recent Recommendations">
              {metrics.recSection && Array.isArray(metrics.recSection.items) && metrics.recSection.items.length > 0 ? (
                <ul className="space-y-4">
                  {metrics.recSection.items.slice(0, 4).map((it: string, i: number) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-600 font-medium leading-relaxed">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#FF0000] shrink-0" />{it}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 font-medium py-8 text-center">Recommendations from your analyses will appear here.</p>
              )}
            </Card>
          </div>
        </AnimatedSection>

        {/* ===================== ROW 5 — RECENT ACTIVITY ===================== */}
        <AnimatedSection as="section" index={4}>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.4em] mb-6">Recent Activity</h2>
          <Card className="!p-8">
            {loadingData ? (
              <p className="text-sm text-gray-400 font-medium py-8 text-center">Loading activity…</p>
            ) : recentActivity.length === 0 ? (
              <EmptyState message="No activity yet" submessage="Your latest analyses and reports will show up here as you work." />
            ) : (
              <div className="divide-y divide-gray-100">
                {recentActivity.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-4">
                      <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold uppercase tracking-widest">{a.kind}</span>
                      <span className="text-sm font-bold text-[#0B0B0B]">{a.label}</span>
                    </div>
                    <span className="text-[11px] font-medium text-gray-400">{a.ts ? new Date(a.ts).toLocaleDateString() : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </AnimatedSection>

        {/* ===================== SUBSCRIPTION + UPSELL ===================== */}
        <AnimatedSection as="section" index={5} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <SubscriptionPanel />
          {lockedFeature
            ? <LockedFeatureCard title={lockedFeature.title} planLabel={lockedFeature.planLabel} description={lockedFeature.description} />
            : tier === 'free'
              ? <UpgradeCard onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
              : null}
        </AnimatedSection>

        {/* ===================== ANALYSIS TOOLS ===================== */}
        <AnimatedSection index={6} className="grid grid-cols-1 gap-12">
          <div id="tools-section" />
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.4em] mb-4">Analysis Tools</h2>
          {NAV_SUITES.map((group, gi) => (
            <div key={group.suite} className="mb-4">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-8 h-[2px] bg-[#FF0000] rounded-full" />
                <h3 className="text-sm font-bold text-white uppercase tracking-[0.3em]">{group.suite}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {group.items.map((tool, ti) => (
                  <Card key={tool.path} accent={gi === 0 && ti === 0} className="group hover:shadow-2xl hover:shadow-black/10 duration-500">
                    <div className="flex flex-col h-full justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <h3 className="text-2xl font-bold text-[#0B0B0B] tracking-tight group-hover:text-[#FF0000] transition-colors duration-500">{tool.label}</h3>
                          {typeof tool.cost === 'number' && (
                            <span className="shrink-0 mt-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold uppercase tracking-widest">{tool.cost} {tool.cost === 1 ? 'Token' : 'Tokens'}</span>
                          )}
                        </div>
                        <p className="text-gray-500 font-medium leading-relaxed mb-12">{tool.description}</p>
                      </div>
                      <Link to={tool.path}>
                        <PrimaryButton className="w-full !px-0 !py-3.5 !text-xs">Open Module</PrimaryButton>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </AnimatedSection>
      </div>
    </div>
  );
};

export default Dashboard;
