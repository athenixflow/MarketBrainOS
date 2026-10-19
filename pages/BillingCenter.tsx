import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PageHeader, Card, PrimaryButton, Stat, Skeleton, EmptyState, LedgerRow, ErrorMessage, SuccessMessage, LoadingState,
} from '../components/UI';
import { TokenStore } from '../components/TokenStore';
import { useAuth } from '../context/AuthContext';
import { getUserPaymentHistory } from '../services/persistenceService';
import { downloadAsCSV, paymentsToCSV } from '../services/exportService';
import { PaymentRecord } from '../types';
import { PLAN_META, DEFAULT_PRICING_CONFIG, Tier } from '../config/pricingConfig';
import { BillingStatus, canPay, fetchBillingStatus, formatPrice, startCheckout } from '../services/billing';
import { paymentView } from '../services/payments';
import { isPassRenewal, renewPassLabel } from '../services/planActions';
import { track } from '../services/analytics';

const LOAD_ERROR = 'We could not load your billing history. Please try again.';

const BillingCenter: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Where a Bachs checkout lands the customer (?checkout=success|cancelled): say what happened.
  const [returned, setReturned] = useState<'success' | 'cancelled' | null>(null);
  /* The pass reminder and expiry emails link here, so a pass is renewed from this page (the same
     naira pass checkout as the plan panel), once payments are live. */
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchBillingStatus().then((s) => { if (alive) setBilling(s); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('checkout');
    const timers: number[] = [];
    if (q === 'success') {
      setReturned('success');
      void refreshProfile();
      /* The webhook grants the plan a few seconds after the redirect, so the first refresh can still show
         the old plan: look again at about 5s and 20s. The timers die with the page. */
      for (const ms of [5000, 20000]) timers.push(window.setTimeout(() => { void refreshProfile(); }, ms));
    }
    if (q === 'cancelled') setReturned('cancelled');
    return () => { timers.forEach((t) => window.clearTimeout(t)); };
    /* Runs once on mount. Listing refreshProfile here would loop if it is not memoised:
       refresh → new profile → new function → effect → refresh. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    getUserPaymentHistory(user.uid)
      .then(setPayments)
      .catch(() => setError(LOAD_ERROR))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  if (!profile) return <LoadingState message="Loading your billing" />;
  const tier = (profile.tier as Tier) || 'free';
  const isFree = tier === 'free';
  const monthly = profile.monthly_tokens ?? profile.tokens ?? 0;
  const purchased = profile.purchased_tokens ?? 0;
  // A naira pass is a one-off 30-day purchase: it has an end date and a naira price, and it does not renew.
  const isPass = !isFree && profile.billing_mode === 'pass';
  // The Free plan never renews: its allowance is a one-time balance.
  const renews = isFree
    ? 'Never'
    : isPass
      ? (profile.pass_expires_at ? new Date(profile.pass_expires_at).toLocaleDateString() : 'Not set')
      : profile.plan_renews_at ? new Date(profile.plan_renews_at).toLocaleDateString() : 'Not set';
  const planName = PLAN_META[tier]?.name || tier;
  const price = DEFAULT_PRICING_CONFIG.plans[tier]?.price ?? 0;
  const priceNgn = DEFAULT_PRICING_CONFIG.plans[tier]?.priceNgn;
  const priceLabel = isFree ? '$0' : isPass && priceNgn ? `${formatPrice(priceNgn, 'NGN')}/30 days` : `$${price}/mo`;
  const canRenew = isPassRenewal(profile, tier, 'NGN') && canPay(billing, profile.role);
  const renew = async () => {
    setRenewing(true); setRenewError(null);
    try {
      track('upgrade_clicked', { plan: tier, surface: 'billing_center', signed_in: true });
      await startCheckout('pass', tier, 'NGN');
    } catch (e: any) {
      // The callable writes its refusals for customers: shown as they are.
      setRenewError(e?.message || 'Checkout could not be started.');
    } finally { setRenewing(false); }
  };
  const views = payments.map((p) => ({ p, v: paymentView(p) }));
  const expansions = views.filter(({ v }) => v.kind === 'expansion');

  return (
    <div>
      <PageHeader title="Billing Center" subtitle="Your plan, token balance, purchases, and invoices." />
      <div className="space-y-6">
        {returned === 'success' && <SuccessMessage message="Payment received — your plan updates within a minute." />}
        {returned === 'cancelled' && <ErrorMessage message="Checkout was cancelled. Nothing was charged." />}
        <Card title="Current plan">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 flex-1 min-w-0">
              <Stat label="Plan" value={planName} />
              <Stat label="Price" value={priceLabel} />
              <Stat label={isPass ? 'Ends' : 'Renews'} value={renews} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {canRenew && (
                <PrimaryButton onClick={renew} disabled={renewing}>{renewing ? 'Opening checkout…' : renewPassLabel(tier)}</PrimaryButton>
              )}
              <Link to="/pricing"><PrimaryButton>Change plan</PrimaryButton></Link>
            </div>
          </div>
          {renewError && <ErrorMessage message={renewError} className="mt-6" />}
        </Card>

        <Card title="Token balance">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Stat label="Total" value={(monthly + purchased).toLocaleString()} />
            <Stat label={isFree ? 'Free allowance' : 'Monthly allowance'} value={monthly.toLocaleString()} />
            <Stat label="Purchased (never expire)" value={purchased.toLocaleString()} />
          </div>
          <p className="mt-6 text-sm text-gray-500 font-medium">
            {isFree
              ? 'Your Free allowance is a one-time balance and does not refill. Purchased tokens never expire.'
              : 'Monthly tokens reset each billing cycle; purchased tokens roll over and never expire.'}
          </p>
        </Card>

        <Card title="Token store">
          <TokenStore onPurchased={load} />
        </Card>

        {expansions.length > 0 && (
          <Card title="Expansion purchases">
            <div className="space-y-3">
              {expansions.map(({ p, v }) => (
                <LedgerRow
                  key={p.id}
                  when={v.date || new Date(0)}
                  title={v.label}
                  detail="Recurring"
                  right={<p className="text-sm font-black text-[#0B0B0B]">{v.display}/mo</p>}
                />
              ))}
            </div>
          </Card>
        )}

        <Card title="Invoices">
          {loading ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : error ? (
            <ErrorMessage message={error} action={{ label: 'Retry', onClick: load }} />
          ) : payments.length === 0 ? (
            <EmptyState message="No transactions yet" submessage="Subscription payments, token packs and expansions will show up here." />
          ) : (
            <>
              <div className="space-y-3 mb-6">
                {views.map(({ p, v }) => (
                  <LedgerRow
                    key={p.id}
                    when={v.date || new Date(0)}
                    title={v.label}
                    detail={<span className="font-mono">Ref: {v.reference || 'N/A'}</span>}
                    right={
                      <div>
                        {p.tokens_credited ? <p className="text-sm font-black text-green-600">+{p.tokens_credited.toLocaleString()} tokens</p> : null}
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{v.display}</p>
                      </div>
                    }
                  />
                ))}
              </div>
              <button onClick={() => downloadAsCSV('MarketBrainOS_Billing_History', paymentsToCSV(payments))} className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors">Export CSV</button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default BillingCenter;
