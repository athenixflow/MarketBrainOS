import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PageHeader, Card, PrimaryButton, Stat, Skeleton, EmptyState, LedgerRow, ErrorMessage, LoadingState,
} from '../components/UI';
import { TokenStore } from '../components/TokenStore';
import { useAuth } from '../context/AuthContext';
import { getUserPaymentHistory } from '../services/persistenceService';
import { downloadAsCSV, paymentsToCSV } from '../services/exportService';
import { PaymentRecord } from '../types';
import { PLAN_META, DEFAULT_PRICING_CONFIG, Tier } from '../config/pricingConfig';

const toDate = (v: any): Date | null => {
  if (!v) return null;
  try { return new Date(v.toMillis ? v.toMillis() : v); } catch { return null; }
};

const payLabel = (p: PaymentRecord): string => {
  const t = (p as any).type;
  if (t === 'expansion') return `Expansion: ${(p as any).expansion_type || 'capacity'}`;
  if (t === 'subscription') return 'Subscription';
  if (t === 'token_pack') return 'Token pack';
  return 'Token top-up';
};

const LOAD_ERROR = 'We could not load your billing history. Please try again.';

const BillingCenter: React.FC = () => {
  const { user, profile } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  // The Free plan never renews: its allowance is a one-time balance.
  const renews = isFree
    ? 'Never'
    : profile.plan_renews_at ? new Date(profile.plan_renews_at).toLocaleDateString() : 'Not set';
  const planName = PLAN_META[tier]?.name || tier;
  const price = DEFAULT_PRICING_CONFIG.plans[tier]?.price ?? 0;
  const expansions = payments.filter((p) => (p as any).type === 'expansion');

  return (
    <div>
      <PageHeader title="Billing Center" subtitle="Your plan, token balance, purchases, and invoices." />
      <div className="space-y-6">
        <Card title="Current plan">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 flex-1 min-w-0">
              <Stat label="Plan" value={planName} />
              <Stat label="Price" value={isFree ? '$0' : `$${price}/mo`} />
              <Stat label="Renews" value={renews} />
            </div>
            <Link to="/pricing"><PrimaryButton>Change plan</PrimaryButton></Link>
          </div>
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
              {expansions.map((p) => (
                <LedgerRow
                  key={p.id}
                  when={toDate(p.created_at) || new Date(0)}
                  title={`${(p as any).expansion_type || 'capacity'} expansion`}
                  detail="Recurring"
                  right={<p className="text-sm font-black text-[#0B0B0B]">${p.amount_paid}/mo</p>}
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
                {payments.map((p) => (
                  <LedgerRow
                    key={p.id}
                    when={toDate(p.created_at) || new Date(0)}
                    title={payLabel(p)}
                    detail={<span className="font-mono">Ref: {p.payment_reference || 'N/A'}</span>}
                    right={
                      <div>
                        {p.tokens_credited ? <p className="text-sm font-black text-green-600">+{p.tokens_credited.toLocaleString()} tokens</p> : null}
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${p.amount_paid}</p>
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
