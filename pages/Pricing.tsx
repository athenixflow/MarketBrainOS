import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import AnimatedSection from '../components/AnimatedSection';
import { useAuth } from '../context/AuthContext';
import { callChangeSubscription } from '../services/persistenceService';
import { DEFAULT_PRICING_CONFIG as CFG, PLAN_META, PLAN_ORDER, Tier } from '../config/pricingConfig';
import Seo from '../components/Seo';
import { MARKETING_SEO, SITE_URL, SITE_NAME } from '../config/seo';

// Product + per-plan Offer structured data (generated from the live pricing config).
const PRICING_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: SITE_NAME,
  description: 'AI marketing intelligence platform. Plans from Free to Enterprise, each with a monthly token allowance plus pay-as-you-go token packs.',
  brand: { '@type': 'Brand', name: SITE_NAME },
  offers: PLAN_ORDER.map((tier) => ({
    '@type': 'Offer',
    name: `${PLAN_META[tier].name} plan`,
    price: String(CFG.plans[tier].price),
    priceCurrency: 'USD',
    url: `${SITE_URL}/pricing`,
    availability: 'https://schema.org/OnlineOnly',
  })),
};

const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const currentTier = profile?.tier as Tier | undefined;
  const currentIdx = currentTier ? PLAN_ORDER.indexOf(currentTier) : -1;
  const [busy, setBusy] = useState<Tier | null>(null);
  const [msg, setMsg] = useState('');

  const select = async (tier: Tier) => {
    if (!user) { navigate('/auth'); return; }
    setMsg('');
    try {
      if (tier === 'free') { navigate('/'); return; }
      if (tier === 'pro') {
        setBusy('pro');
        await callChangeSubscription('upgrade');
        await refreshProfile();
        setMsg('You are now on Pro.');
        setTimeout(() => navigate('/'), 1200);
        return;
      }
      // Team/Agency/Enterprise are provisioned in their hubs (creating the container upgrades the plan).
      navigate(tier === 'team' ? '/team' : tier === 'agency' ? '/agency' : '/enterprise');
    } catch (e: any) { setMsg(e.message || 'Upgrade failed.'); } finally { setBusy(null); }
  };

  const ctaLabel = (tier: Tier, idx: number) => {
    if (!user) return tier === 'free' ? 'Start free' : 'Get started';
    if (currentTier === tier) return 'Current plan';
    if (currentIdx >= 0 && idx < currentIdx) return 'Included';
    return tier === 'pro' ? (busy === 'pro' ? 'Upgrading…' : 'Upgrade to Pro') : `Upgrade to ${PLAN_META[tier].name}`;
  };
  const ctaDisabled = (tier: Tier, idx: number) =>
    busy !== null || (!!user && (currentTier === tier || (currentIdx >= 0 && idx < currentIdx)));

  const expansionLine = (tier: Tier): string | null => {
    if (tier === 'team') return `Extra seats $${CFG.expansion.member}/mo`;
    if (tier === 'agency') return `+$${CFG.expansion.workspace} workspace · +$${CFG.expansion.member} seat`;
    if (tier === 'enterprise') return `+$${CFG.expansion.agency} agency · +$${CFG.expansion.workspace} workspace · +$${CFG.expansion.member} seat`;
    return null;
  };

  return (
    <PublicLayout>
      <Seo {...MARKETING_SEO.pricing} jsonLd={PRICING_JSONLD} />
      <AnimatedSection as="section" index={0} className="pt-24 pb-12 px-6 md:px-12 max-w-7xl mx-auto text-center">
        <span className="text-sm font-bold text-[#FF0000] uppercase tracking-[0.2em] mb-6 block">Pricing</span>
        <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight mb-8 leading-[1.1]">Scale from solo to enterprise.</h1>
        <p className="text-xl text-gray-400 font-medium leading-relaxed max-w-2xl mx-auto">
          Every plan includes a monthly token allowance. Buy token packs anytime (they never expire), and add
          seats, workspaces, or agencies as you grow.
        </p>
      </AnimatedSection>

      <AnimatedSection as="section" index={1} className="pb-16 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {PLAN_ORDER.map((tier, idx) => {
            const plan = CFG.plans[tier];
            const meta = PLAN_META[tier];
            const popular = tier === 'pro';
            const exp = expansionLine(tier);
            return (
              <div key={tier} className={`p-7 rounded-3xl flex flex-col ${popular ? 'border-2 border-[#FF0000]/40 bg-[#111] shadow-2xl shadow-red-900/10' : 'border border-gray-800 bg-[#0B0B0B]'}`}>
                {popular && <div className="self-start bg-[#FF0000] text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3">Most popular</div>}
                <h3 className="text-xl font-bold text-white">{meta.name}</h3>
                <p className="text-gray-500 text-xs mb-5 mt-1">{meta.tagline}</p>
                <div className="text-3xl font-black text-white mb-1">${plan.price}<span className="text-base font-medium text-gray-600">/mo</span></div>
                <p className="text-[#FF0000] text-xs font-bold uppercase tracking-widest mb-5">{plan.monthlyTokens.toLocaleString()} tokens / mo</p>

                <ul className="space-y-2.5 mb-5 text-[13px] text-gray-300 flex-grow">
                  {meta.capacity.map((c, i) => (
                    <li key={`c${i}`} className="flex items-start gap-2.5"><div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full mt-1.5 shrink-0" />{c}</li>
                  ))}
                  {meta.features.map((f, i) => (
                    <li key={`f${i}`} className="flex items-start gap-2.5"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full mt-1.5 shrink-0" /><span className="text-gray-400">{f}</span></li>
                  ))}
                </ul>

                {exp && <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">{exp}</p>}

                <button
                  onClick={() => select(tier)}
                  disabled={ctaDisabled(tier, idx)}
                  className={`w-full py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-opacity disabled:opacity-40 ${popular ? 'bg-[#FF0000] text-white hover:opacity-90' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  {ctaLabel(tier, idx)}
                </button>
              </div>
            );
          })}
        </div>

        {msg && <p className="text-center text-sm text-white font-semibold mt-8">{msg}</p>}
        <p className="text-center text-xs text-gray-600 mt-10 max-w-2xl mx-auto leading-relaxed">
          Monthly tokens reset each billing cycle; purchased token packs never expire. Tokens are only charged
          when an analysis completes — failed runs are automatically refunded.
        </p>
      </AnimatedSection>
    </PublicLayout>
  );
};

export default Pricing;
