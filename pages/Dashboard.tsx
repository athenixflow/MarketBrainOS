
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, PrimaryButton, UpgradeCard, TokenStatusBanner, TokenHistoryModal, PaymentHistoryModal } from '../components/UI';
import AnimatedSection from '../components/AnimatedSection';
import SubscriptionPanel from '../components/SubscriptionPanel';
import { useAuth } from '../context/AuthContext';
import { callConfirmTopUp, replayOnboarding, createNotification } from '../services/persistenceService';
import { NAV_SUITES } from '../config/toolConfigs';

const Dashboard: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();

  const handleReplayTour = async () => {
    if (!user) return;
    await replayOnboarding(user.uid);
    await refreshProfile();
  };
  const [topUpStatus, setTopUpStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showReceipts, setShowReceipts] = useState(false);

  const handleTopUp = async () => {
    if (profile?.tier !== 'pro') return;
    setTopUpStatus('processing');
    setFeedbackMsg('');
    
    try {
      // In a real environment, this would be the result of a Stripe/Payment Provider interaction.
      // We simulate a unique payment reference here which the server validates.
      const mockPaymentRef = `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Authoritative Server Call
      await callConfirmTopUp(mockPaymentRef);
      
      // Update Local State from Server Source of Truth
      await refreshProfile();
      
      setTopUpStatus('success');
      setFeedbackMsg('100 tokens credited successfully.');
      if (user) createNotification(user.uid, 'Token', 'Top-up successful', '100 tokens have been added to your balance.');
      
      // Reset state after delay
      setTimeout(() => {
        setTopUpStatus('idle');
        setFeedbackMsg('');
      }, 4000);

    } catch (e: any) {
      setTopUpStatus('error');
      setFeedbackMsg(e.message || "Transaction failed. No tokens charged.");
    }
  };

  const getUsageColor = (tokens: number) => {
    if (tokens === 0) return 'text-red-500';
    if (tokens < 10) return 'text-orange-500';
    if (tokens < 50) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getUsageMessage = (tokens: number) => {
    if (tokens === 0) return "Allowance exhausted.";
    if (tokens < 10) return "Critical level. Top up recommended.";
    if (tokens < 50) return "Running low.";
    return "Operational.";
  };

  return (
    <div className="space-y-12">
      {profile && <TokenStatusBanner tier={profile.tier} tokens={profile.tokens} />}
      {showHistory && <TokenHistoryModal onClose={() => setShowHistory(false)} />}
      {showReceipts && <PaymentHistoryModal onClose={() => setShowReceipts(false)} />}
      
      <div className="space-y-24">
        <AnimatedSection index={0}>
          <PageHeader
            title="Predictive Marketing Intelligence"
            subtitle="MarketBrainOS is an executive-grade software platform for pre-validating marketing assets. It utilizes AI to audit conversion funnels, simulate campaign performance, and generate psychological profiles."
          />
        </AnimatedSection>

        {/* OPERATIONAL RESOURCES & TOKENS */}
        <AnimatedSection as="section" index={1}>
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.4em]">Operational Resources</h2>
            <div className="flex gap-6">
              <button 
                onClick={() => setShowHistory(true)}
                className="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2"
              >
                View Usage History
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button
                onClick={handleReplayTour}
                className="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest transition-colors"
              >
                Replay Tour
              </button>
              {profile?.tier === 'pro' && (
                <button 
                  onClick={() => setShowReceipts(true)}
                  className="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2"
                >
                  View Receipts
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <Card className="!p-10 flex flex-col md:flex-row items-center justify-between gap-12 bg-[#121212] border-gray-900">
            
            {/* BALANCE DISPLAY */}
            <div className="flex-grow">
              <div className="flex items-center gap-4 mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Available Intelligence Credits</p>
                {profile?.tier === 'pro' && <span className="px-2 py-0.5 rounded-full bg-[#FF0000] text-white text-[9px] font-bold uppercase tracking-widest">PRO</span>}
                {profile?.tier === 'free' && <span className="px-2 py-0.5 rounded-full bg-gray-700 text-white text-[9px] font-bold uppercase tracking-widest">FREE</span>}
              </div>
              
              <div className="flex items-baseline gap-4">
                <span className="text-5xl font-black text-white">{profile?.tokens || 0}</span>
                <span className={`text-sm font-bold uppercase tracking-widest ${getUsageColor(profile?.tokens || 0)}`}>
                  {getUsageMessage(profile?.tokens || 0)}
                </span>
              </div>
              {profile?.tier === 'free' && (
                <p className="text-xs text-gray-500 mt-4 max-w-md">
                  Free tier is limited to 4 credits/mo. Upgrade to Pro for 200 credits/mo and top-up capability.
                </p>
              )}
            </div>

            {/* ACTIONS */}
            <div className="w-full md:w-auto flex flex-col items-end gap-4">
              {profile?.tier === 'pro' ? (
                <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                  <button 
                    onClick={handleTopUp}
                    disabled={topUpStatus === 'processing' || topUpStatus === 'success'}
                    className={`
                      w-full md:w-auto px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all
                      ${topUpStatus === 'success' ? 'bg-green-500 text-white cursor-default' : 'bg-white text-[#0B0B0B] hover:bg-gray-200 active:scale-95'}
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {topUpStatus === 'processing' ? 'Processing...' : topUpStatus === 'success' ? 'Credited' : 'Top Up Tokens'}
                  </button>
                  <div className="flex justify-between w-full md:w-auto gap-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    <span>Price: $5.00</span>
                    <span>Credits: +100</span>
                  </div>
                  
                  {/* FEEDBACK MESSAGES */}
                  {feedbackMsg && (
                    <p className={`text-[10px] font-bold uppercase tracking-widest animate-in fade-in ${topUpStatus === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                      {feedbackMsg}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-end gap-4">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Manage your plan below to unlock<br className="hidden md:block" /> top-ups & higher limits</p>
                </div>
              )}
            </div>
          </Card>
        </AnimatedSection>

        {/* SUBSCRIPTION MANAGEMENT (§30–32) */}
        <AnimatedSection as="section" index={2}>
          <SubscriptionPanel />
        </AnimatedSection>

        <AnimatedSection index={3} className="grid grid-cols-1 gap-12">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.4em] mb-4">Intelligence Suites</h2>
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
                        <p className="text-gray-500 font-medium leading-relaxed mb-12">
                          {tool.description}
                        </p>
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
          {profile?.tier === 'free' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              <UpgradeCard onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
            </div>
          )}
        </AnimatedSection>

        <AnimatedSection index={3} className="pt-12">
          <Card className="!bg-[#0D0D0D] !border-gray-900 !text-white !p-16">
            <div className="max-w-xl">
              <p className="text-[#FF0000] text-xs font-bold uppercase tracking-[0.3em] mb-6">System Status</p>
              <h3 className="text-3xl font-bold tracking-tight mb-6">Intelligence Engine Active</h3>
              <p className="text-gray-400 font-medium leading-relaxed mb-10">
                The neural processing core is online. All modules are calibrated for decision-grade analysis and performance simulation.
              </p>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Neural Stability: 100%</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#FF0000] shadow-[0_0_10px_rgba(255,0,0,0.5)]" />
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Latency: 14ms</span>
                </div>
              </div>
            </div>
          </Card>
        </AnimatedSection>
      </div>
    </div>
  );
};

export default Dashboard;
