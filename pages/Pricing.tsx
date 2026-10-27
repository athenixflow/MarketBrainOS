import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import AnimatedSection from '../components/AnimatedSection';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PRICING_CONFIG as CFG, PLAN_META, PLAN_ORDER, Tier } from '../config/pricingConfig';
import Seo from '../components/Seo';
import { MARKETING_SEO, SITE_URL, SITE_NAME } from '../config/seo';
import { track } from '../services/analytics';
import { fetchBillingStatus, BillingStatus, Currency, formatPrice, canPay, startCheckout, callManageBilling, defaultCurrency } from '../services/billing';
import { useCurrency } from '../components/useCurrency';
import CurrencyToggle from '../components/CurrencyToggle';
import { usdChargeNote } from '../services/planActions';
import { isPassRenewal, passReplaceNotice, subscriptionUpgradeBlock } from '../services/planActions';
import { Modal, PrimaryButton, SecondaryButton } from '../components/UI';

// Product + per-plan Offer structured data (generated from the live pricing config).
const PRICING_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: SITE_NAME,
  description: 'AI marketing intelligence platform. Plans from Free to Enterprise, with monthly token allowances on paid plans plus pay-as-you-go token packs.',
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
  /*
   * GTM E01 — the denominator of free→paid (part 03 §7.2). Fired on arrival rather than
   * on a CTA, because the page being READ and the page being ACTED ON are the two numbers
   * the plan's pricing experiments need to tell apart.
   */
  useEffect(() => { track('pricing_viewed', { surface: 'pricing_page' }); }, []);
  const { user, profile, refreshProfile } = useAuth();
  /* A pass bought minutes ago lands by webhook, after the profile was read at sign-in. Re-read it on
     open and whenever the tab regains focus (coming back from checkout), or the page shows the old
     plan and skips the replace-your-pass warning. */
  useEffect(() => {
    if (!user) return;
    const refresh = () => { refreshProfile().catch(() => {}); };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);
  const currentTier = profile?.tier as Tier | undefined;
  const currentIdx = currentTier ? PLAN_ORDER.indexOf(currentTier) : -1;
  const [busy, setBusy] = useState<Tier | null>(null);
  const [msg, setMsg] = useState('');

  /* The same switch as the in-app panel: a pricing page that starts a checkout which
     cannot charge is the worst place in the product to be wrong about this. */
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [currency, setCurrency] = useCurrency(profile?.billing_currency);
  const usdNote = usdChargeNote(defaultCurrency(), currency);
  useEffect(() => {
    let alive = true;
    void fetchBillingStatus().then((s) => { if (alive) setBilling(s); });
    return () => { alive = false; };
  }, []);
  const payable = canPay(billing, profile?.role);

  /* A higher naira pass replaces the live one from today, unrefunded (spec §5): the buyer agrees first. */
  const [replacing, setReplacing] = useState<{ tier: Tier; notice: string } | null>(null);

  const select = async (tier: Tier, confirmed = false) => {
    /* Intent, captured before the branch that sends a signed-out visitor to /auth — so a
       tier chosen by somebody without an account still counts as interest in that tier. */
    if (!confirmed) track('upgrade_clicked', { plan: tier, surface: 'pricing_page', signed_in: !!user });
    if (!user) { navigate('/auth'); return; }
    setMsg('');
    try {
      if (tier === 'free') { navigate('/'); return; }
      /*
       * NO CHECKOUT UNLESS THE SERVER WOULD ACCEPT IT.
       *
       * `createCheckout` refuses everyone but a super-admin until billing is live, so this
       * button sends people to support instead, which is the honest version of the same
       * intent. Once live, nothing here changes a tier: a checkout (or `manageBilling` for
       * a USD subscription) goes to Bachs and the webhook grants the plan after payment.
       */
      if (!payable) {
        setMsg('Card payments are not live yet. Email support and we will set your plan up by hand.');
        return;
      }
      /* Enterprise is not sold online: it is set up with us, so the button leads to Support. */
      if (tier === 'enterprise') { navigate('/support'); return; }
      if (currency === 'NGN') {
        const notice = passReplaceNotice(profile, tier, new Date());
        if (notice && !confirmed) { setReplacing({ tier, notice }); return; }
      }
      setBusy(tier);
      if (currency === 'USD' && profile?.billing_mode === 'subscription') {
        await callManageBilling('upgrade', tier);
        setMsg('Upgrade requested — your plan changes as soon as Bachs confirms the payment.');
        return;
      }
      await startCheckout(currency === 'USD' ? 'plan' : 'pass', tier, currency);
    } catch (e: any) { setMsg(e.message || 'Upgrade failed.'); } finally { setBusy(null); }
  };

  /* A naira pass holder's own tier, in naira, is a way to pay again: the pass reminder emails land
     here. It goes through the same pass checkout as any other pass (select → startCheckout). */
  const renewable = (tier: Tier) => payable && isPassRenewal(profile, tier, currency);
  /* A cancelling or past-due dollar subscription is not upgraded (the server refuses it too). */
  const upgradeBlock = subscriptionUpgradeBlock(profile);
  const upgradeBlocked = (tier: Tier, idx: number) =>
    !!upgradeBlock && currency === 'USD' && tier !== 'enterprise' && currentIdx >= 0 && idx > currentIdx;
  const ctaLabel = (tier: Tier, idx: number) => {
    if (!user) return tier === 'free' ? 'Start free' : 'Get started';
    if (currentTier === tier) return renewable(tier) ? 'Renew (+30 days)' : 'Current plan';
    if (currentIdx >= 0 && idx < currentIdx) return 'Included';
    /* Until there is a way to pay, the button does not offer to take money. */
    if (!payable && tier !== 'free') return 'Talk to us';
    if (upgradeBlocked(tier, idx)) return 'Upgrade unavailable';
    if (busy === tier) return 'Processing…';
    if (tier === 'enterprise') return 'Contact sales';
    /* "— 30 days" only where a naira pass exists: Enterprise has none and keeps its normal label. */
    return currency === 'NGN' && CFG.plans[tier].priceNgn ? `Get ${PLAN_META[tier].name} — 30 days` : `Upgrade to ${PLAN_META[tier].name}`;
  };
  const ctaDisabled = (tier: Tier, idx: number) =>
    busy !== null || (!!user && ((currentTier === tier && !renewable(tier)) || (currentIdx >= 0 && idx < currentIdx) || upgradeBlocked(tier, idx)));

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
          Every paid plan refills your tokens each month, and Free starts you with a one-time allowance.
          Buy token packs anytime (they never expire), and add seats, workspaces, or agencies as you grow.
        </p>
      </AnimatedSection>

      <AnimatedSection as="section" index={1} className="pb-16 px-6 md:px-12 max-w-7xl mx-auto">
        <CurrencyToggle value={currency} onChange={setCurrency} className="justify-center mb-8" />
        {currency === 'NGN' && <p className="text-center text-xs text-gray-400 mb-8">Naira plans are 30-day passes: pay once, no automatic charge. We email you before it ends.</p>}
        {currency === 'USD' && upgradeBlock && <p className="text-center text-xs text-gray-400 mb-8">{upgradeBlock}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {PLAN_ORDER.map((tier, idx) => {
            const plan = CFG.plans[tier];
            const meta = PLAN_META[tier];
            const popular = tier === 'pro';
            const exp = expansionLine(tier);
            /* Naira shows ₦0 on Free too; Enterprise has no naira price (sales-led) and stays in dollars. */
            const ngnPrice = currency === 'NGN' ? (plan.price === 0 ? 0 : plan.priceNgn) : undefined;
            return (
              <div key={tier} className={`relative p-7 rounded-2xl flex flex-col ${popular ? 'border-2 border-[#FF0000]/40 bg-[#111] shadow-2xl shadow-red-900/10' : 'border border-gray-800 bg-[#0B0B0B]'}`}>
                {/* absolute so the badge does not push this card's content down relative to its row siblings */}
                {popular && <div className="absolute top-0 right-4 -translate-y-1/2 bg-[#E00000] text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">Most popular</div>}
                <h3 className="text-xl font-bold text-white">{meta.name}</h3>
                <p className="text-gray-400 text-xs mb-5 mt-1">{meta.tagline}</p>
                <div className="text-3xl font-black text-white mb-1">
                  {ngnPrice !== undefined ? formatPrice(ngnPrice, 'NGN') : formatPrice(plan.price, 'USD')}
                  {/* In naira the suffix sits on its own line on every card: "/30 days" does not fit beside ₦120,000 at five
                      columns, and a wrap on some cards only would push their token line out of line with the rest of the row. */}
                  <span className={`text-base font-medium text-gray-400 ${currency === 'NGN' ? 'block' : ''}`}>{ngnPrice ? '/30 days' : '/mo'}</span>
                </div>
                {/* A dollar price in front of a naira buyer says so: dollars they chose (D1), or Enterprise, which
                    has no naira price and is billed in USD (it read "$999/mo" under the Naira toggle). */}
                {plan.price > 0 && ngnPrice === undefined && (usdNote || currency === 'NGN') && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-2">{currency === 'NGN' ? 'Billed in USD' : usdNote}</p>
                )}
                <p className="text-[#FF0000] text-xs font-bold uppercase tracking-widest mb-5">
                  {plan.monthlyTokens.toLocaleString()} tokens {tier === 'free' ? 'one-time' : '/ mo'}
                </p>

                <ul className="space-y-2.5 mb-5 text-[13px] text-gray-300 flex-grow">
                  {meta.capacity.map((c, i) => (
                    <li key={`c${i}`} className="flex items-start gap-2.5"><div className="w-1.5 h-1.5 bg-[#FF0000] rounded-full mt-1.5 shrink-0" />{c}</li>
                  ))}
                  {meta.features.map((f, i) => (
                    <li key={`f${i}`} className="flex items-start gap-2.5"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full mt-1.5 shrink-0" /><span className="text-gray-400">{f}</span></li>
                  ))}
                </ul>

                {exp && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4">{exp}</p>}

                <button
                  onClick={() => select(tier)}
                  disabled={ctaDisabled(tier, idx)}
                  className={`w-full py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-opacity disabled:opacity-40 ${popular ? 'bg-[#E00000] text-white hover:opacity-90' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  {ctaLabel(tier, idx)}
                </button>
              </div>
            );
          })}
        </div>

        {msg && <p className="text-center text-sm text-white font-semibold mt-8">{msg}</p>}
        {replacing && (
          <Modal title="Replace your pass?" size="sm" onClose={() => setReplacing(null)}
            footer={
              <div className="flex flex-wrap justify-end gap-3">
                <SecondaryButton onClick={() => setReplacing(null)}>Keep my pass</SecondaryButton>
                <PrimaryButton onClick={() => { const t = replacing.tier; setReplacing(null); void select(t, true); }}>Continue to checkout</PrimaryButton>
              </div>
            }>
            <p className="text-sm text-gray-600 font-medium leading-relaxed">{replacing.notice}</p>
          </Modal>
        )}
        <p className="text-center text-xs text-gray-400 mt-10 max-w-2xl mx-auto leading-relaxed">
          On paid plans monthly tokens reset each billing cycle; the Free allowance is one-time. Purchased
          token packs never expire. Tokens are only charged when an analysis completes, and failed runs are
          automatically refunded.
        </p>
      </AnimatedSection>
    </PublicLayout>
  );
};

export default Pricing;
