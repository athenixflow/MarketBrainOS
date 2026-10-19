import React, { useEffect, useState } from 'react';
import { Card, PrimaryButton, SecondaryButton, Badge, SuccessMessage, ErrorMessage, useConfirmTap } from './UI';
import { useAuth } from '../context/AuthContext';
import { isPaidTier } from '../config/access';
import { SubscriptionStatus } from '../types';
import { DEFAULT_PRICING_CONFIG, PLAN_META } from '../config/pricingConfig';
import { track } from '../services/analytics';
import { fetchBillingStatus, BillingStatus, Currency, formatPrice, canPay, startCheckout, callManageBilling } from '../services/billing';
import { useCurrency } from './useCurrency';
import { checkoutReturn, renewPassLabel } from '../services/planActions';

// Derived, never hardcoded: plan copy must track the pricing config or it drifts (it previously
// advertised 200 tokens while the config granted 100).
const PRO = DEFAULT_PRICING_CONFIG.plans.pro;

type BadgeTone = 'neutral' | 'red' | 'green' | 'blue' | 'yellow' | 'dark';
const STATUS_BADGE: Record<SubscriptionStatus, { label: string; tone: BadgeTone }> = {
  free: { label: 'Free', tone: 'neutral' },
  active: { label: 'Active', tone: 'green' },
  past_due: { label: 'Past due', tone: 'yellow' },
  cancelled: { label: 'Cancelled', tone: 'yellow' },
  expired: { label: 'Expired', tone: 'red' },
};

/**
 * The account's plan and what can be done with it (spec §5). Every money action goes to Bachs:
 * a checkout for a new plan or pass, `manageBilling` for a USD subscription. Nothing here changes
 * a tier — the webhook does, once Bachs confirms the payment.
 *
 * There is no "Downgrade to Free": a cancelled USD subscription ends at the period's end through
 * Bachs, and a naira pass simply expires.
 */
const SubscriptionPanel: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  // Tone of `msg` is tracked here rather than inferred from the text.
  const [msgErr, setMsgErr] = useState(false);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [currency, setCurrency] = useCurrency(profile?.billing_currency);

  useEffect(() => {
    let alive = true;
    void fetchBillingStatus().then((s) => { if (alive) setBilling(s); });
    const { outcome: q, kind } = checkoutReturn(window.location.search);
    if (q === 'success') {
      setMsg(kind === 'pack' ? 'Payment received — your tokens arrive within a minute.' : 'Payment received — your plan updates within a minute.');
      void refreshProfile();
    }
    if (q === 'cancelled') { setMsgErr(true); setMsg('Checkout was cancelled. Nothing was charged.'); }
    return () => { alive = false; };
    /* Runs once on mount. Listing refreshProfile here would loop if it is not memoised:
       refresh → new profile → new function → effect → refresh. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelTap = useConfirmTap(() => act('cancel'));
  if (!profile) return null;

  const planName = PLAN_META[profile.tier]?.name || profile.tier;
  const planTokens = DEFAULT_PRICING_CONFIG.plans[profile.tier]?.monthlyTokens ?? PRO.monthlyTokens;
  const status: SubscriptionStatus = profile.subscription_status || (isPaidTier(profile.tier) ? 'active' : 'free');
  const badge = STATUS_BADGE[status] || STATUS_BADGE.free;
  const isPaid = isPaidTier(profile.tier);
  const isPass = profile.billing_mode === 'pass';
  const isSub = profile.billing_mode === 'subscription';
  const payable = canPay(billing, profile.role);
  const proPrice = currency === 'NGN' ? formatPrice(PRO.priceNgn ?? 0, 'NGN') + ' for 30 days' : formatPrice(PRO.price, 'USD') + '/mo';

  async function act(action: 'buy-pro' | 'renew-pass' | 'cancel' | 'portal') {
    if (!user) return;
    setBusy(action); setMsg(''); setMsgErr(false);
    try {
      if (action === 'buy-pro') {
        track('upgrade_clicked', { plan: 'pro', surface: 'subscription_panel', signed_in: true });
        await startCheckout(currency === 'USD' ? 'plan' : 'pass', 'pro', currency);
      } else if (action === 'renew-pass') {
        track('upgrade_clicked', { plan: String(profile!.tier), surface: 'subscription_panel', signed_in: true });
        await startCheckout('pass', String(profile!.tier), 'NGN');
      } else if (action === 'portal') {
        const r = await callManageBilling('portal');
        if (r.url) window.location.assign(r.url);
      } else {
        await callManageBilling('cancel');
        await refreshProfile();
        setMsg('Cancelled. You keep access until the end of the period.');
      }
    } catch (e: any) {
      // The callables write their refusals for customers ("You have an active naira pass…"): shown as they are.
      setMsgErr(true); setMsg(e.message || 'That did not work.');
    } finally { setBusy(''); }
  }

  const ends = profile.pass_expires_at || profile.plan_renews_at;

  return (
    <Card title="Subscription">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-[#0B0B0B]">{planName}</span>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>
        {isPaid && ends && (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">
            {isPass ? 'Ends' : status === 'cancelled' ? 'Access until' : 'Renews'} {new Date(ends).toLocaleDateString()}
          </p>
        )}
      </div>

      <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
        {!isPaid && `Your Free allowance is a one-time balance and does not refill. ${PLAN_META.pro.name} gives you ${PRO.monthlyTokens} tokens every month and the ability to top up.`}
        {isPass && `Your ${planName} pass includes ${planTokens} tokens. It does not renew by itself — renewing early adds 30 days to the end.`}
        {isSub && status !== 'cancelled' && `${planName} renews monthly and includes ${planTokens} tokens each period. Purchased tokens never expire.`}
        {isSub && status === 'cancelled' && `Your ${planName} plan is cancelled and will not renew. You keep access until the end of the period.`}
        {isPaid && !isPass && !isSub && `${planName} was set up by our team. Contact support to change it.`}
      </p>

      {!payable && (isPaid ? isPass : true) && (
        <p className="text-sm text-gray-500 mb-6">Card payments are not live yet. Email support and we will set your plan up by hand.</p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {payable && !isPaid && (
          <>
            <div className="flex" role="group" aria-label="Currency">
              {(['NGN', 'USD'] as Currency[]).map((c) => (
                <button key={c} type="button" onClick={() => setCurrency(c)} aria-pressed={currency === c} aria-label={c === 'NGN' ? 'Naira' : 'US dollars'}
                  className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest border border-gray-200 first:rounded-l-lg last:rounded-r-lg ${currency === c ? 'bg-[#0B0B0B] text-white' : 'text-gray-500'}`}>
                  {c === 'NGN' ? '₦' : '$'}
                </button>
              ))}
            </div>
            <PrimaryButton size="md" onClick={() => act('buy-pro')} disabled={!!busy}>
              {busy === 'buy-pro' ? 'Opening checkout…' : `Get ${PLAN_META.pro.name}, ${proPrice}`}
            </PrimaryButton>
          </>
        )}
        {payable && isPass && (
          <PrimaryButton size="md" onClick={() => act('renew-pass')} disabled={!!busy}>
            {busy === 'renew-pass' ? 'Opening checkout…' : renewPassLabel(String(profile.tier))}
          </PrimaryButton>
        )}
        {isSub && (
          <>
            <SecondaryButton onClick={() => act('portal')} disabled={!!busy}>{busy === 'portal' ? 'Opening…' : 'Update card'}</SecondaryButton>
            {status !== 'cancelled' && (
              <SecondaryButton onClick={cancelTap.tap} disabled={!!busy} className={cancelTap.armed ? '!border-[#FF0000] !text-[#FF0000]' : ''}>
                {busy === 'cancel' ? 'Cancelling…' : cancelTap.armed ? 'Tap again to cancel' : 'Cancel plan'}
              </SecondaryButton>
            )}
          </>
        )}
      </div>

      {msg && (msgErr ? <ErrorMessage message={msg} className="mt-6" /> : <SuccessMessage message={msg} className="mt-6" />)}
    </Card>
  );
};

export default SubscriptionPanel;
