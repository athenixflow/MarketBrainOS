import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, PrimaryButton } from '../components/UI';
import { TokenStore } from '../components/TokenStore';
import { useAuth } from '../context/AuthContext';
import { getUserPaymentHistory } from '../services/persistenceService';
import { downloadAsCSV, paymentsToCSV } from '../services/exportService';
import { PaymentRecord } from '../types';
import { PLAN_META, DEFAULT_PRICING_CONFIG, Tier } from '../config/pricingConfig';

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
    <p className="text-xl font-black text-[#0B0B0B] mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</p>
  </div>
);

const toDate = (v: any): Date | null => {
  if (!v) return null;
  try { return new Date(v.toMillis ? v.toMillis() : v); } catch { return null; }
};

const payLabel = (p: PaymentRecord): string => {
  const t = (p as any).type;
  if (t === 'expansion') return `Expansion — ${(p as any).expansion_type || 'capacity'}`;
  if (t === 'subscription') return 'Subscription';
  if (t === 'token_pack') return 'Token pack';
  return 'Token top-up';
};

const BillingCenter: React.FC = () => {
  const { user, profile } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!user) return;
    setLoading(true);
    getUserPaymentHistory(user.uid).then(setPayments).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  if (!profile) return null;
  const tier = (profile.tier as Tier) || 'free';
  const monthly = profile.monthly_tokens ?? profile.tokens ?? 0;
  const purchased = profile.purchased_tokens ?? 0;
  const renews = profile.plan_renews_at ? new Date(profile.plan_renews_at).toLocaleDateString() : '—';
  const planName = PLAN_META[tier]?.name || tier;
  const price = DEFAULT_PRICING_CONFIG.plans[tier]?.price ?? 0;
  const expansions = payments.filter((p) => (p as any).type === 'expansion');

  return (
    <div>
      <PageHeader title="Billing Center" subtitle="Your plan, token balance, purchases, and invoices." />
      <div className="space-y-6">
        <Card title="Current plan">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-wrap gap-10">
              <Stat label="Plan" value={planName} />
              <Stat label="Price" value={`$${price}/mo`} />
              <Stat label="Renews" value={renews} />
            </div>
            <Link to="/pricing"><PrimaryButton>Change plan</PrimaryButton></Link>
          </div>
        </Card>

        <Card title="Token balance">
          <div className="flex flex-wrap gap-10">
            <Stat label="Total" value={monthly + purchased} />
            <Stat label="Monthly allowance" value={monthly} />
            <Stat label="Purchased (never expire)" value={purchased} />
          </div>
          <p className="mt-4 text-sm text-gray-500 font-medium">Monthly tokens reset each billing cycle; purchased tokens roll over and never expire.</p>
        </Card>

        <Card title="Token store">
          <TokenStore onPurchased={load} />
        </Card>

        {expansions.length > 0 && (
          <Card title="Expansion purchases">
            <div className="space-y-3">
              {expansions.map((p) => {
                const d = toDate(p.created_at);
                return (
                  <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100">
                    <div>
                      <p className="text-sm font-bold text-[#0B0B0B] capitalize">{(p as any).expansion_type || 'capacity'} expansion</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{d ? d.toLocaleDateString() : ''} • recurring</p>
                    </div>
                    <p className="text-sm font-black text-[#0B0B0B]">${p.amount_paid}/mo</p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <Card title="Invoices">
          {loading ? (
            <p className="text-sm text-gray-400 font-medium py-6 text-center">Loading…</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-gray-400 font-medium py-6 text-center">No transactions yet.</p>
          ) : (
            <>
              <div className="space-y-3 mb-6">
                {payments.map((p) => {
                  const d = toDate(p.created_at);
                  return (
                    <div key={p.id} className="flex items-center justify-between p-5 rounded-2xl bg-gray-50 border border-gray-100">
                      <div>
                        <p className="text-sm font-bold text-[#0B0B0B]">{payLabel(p)}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{d ? d.toLocaleDateString() : ''} • Ref {p.payment_reference || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        {p.tokens_credited ? <p className="text-sm font-black text-green-600">+{p.tokens_credited.toLocaleString()} tokens</p> : null}
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${p.amount_paid}</p>
                      </div>
                    </div>
                  );
                })}
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
