// Revenue — MRR/ARR/ARPU/LTV and the transaction ledger, from the payments collection.

import React, { useMemo } from 'react';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, AdminTable, KpiCard, Pill, Column, CurrencyPair } from '../primitives';
import { LineChart, DonutChart, bucketByDay } from '../Charts';
import { downloadAsCSV, paymentsToCSV } from '../../../services/exportService';
import { CurrencySums, PayCurrency, formatMinor, formatSums, paymentView, sumByCurrency } from '../../../services/payments';
import { PaymentRecord } from '../../../types';
import { fmtDate, money } from '../util';
import { DEFAULT_PRICING_CONFIG, PLAN_META, Tier } from '../../../config/pricingConfig';

const CURRENCIES: PayCurrency[] = ['USD', 'NGN'];
const perHead = (s: CurrencySums, n: number): CurrencySums => ({ USD: n ? s.USD / n : 0, NGN: n ? s.NGN / n : 0 });
const chartFormat = (c: PayCurrency) => (major: number) => formatMinor(Math.round(major * 100), c);

const Revenue: React.FC = () => {
  const a = useAdmin();

  const d = useMemo(() => {
    /* Every amount comes from the payments adapter and stays in its own currency: ₦ is never added to $. */
    const views = a.payments.map(paymentView);
    const total = sumByCurrency(views);
    const paidUsers = a.users.filter(u => u.tier !== 'free').length;
    const activePro = a.users.filter(u => u.subscription_status === 'active').length;
    // MRR by plan from the config prices (all paid tiers, not just Pro).
    const paidTiers: Tier[] = ['pro', 'team', 'agency', 'enterprise'];
    const byPlan = paidTiers
      .map(t => ({ label: PLAN_META[t].name, value: a.users.filter(u => u.tier === t).length * (DEFAULT_PRICING_CONFIG.plans[t].price || 0) }))
      .filter(x => x.value > 0);
    const mrr = byPlan.reduce((s, x) => s + x.value, 0);
    // Revenue by source from the payments ledger, one breakdown per currency (refunds are not a source).
    const bySource = (c: PayCurrency) => {
      let subs = 0, passes = 0, packs = 0, exp = 0;
      views.forEach(v => {
        if (v.currency !== c || v.kind === 'refund') return;
        const amt = v.amountMinor / 100;
        if (v.kind === 'expansion') exp += amt; else if (v.kind === 'plan') subs += amt; else if (v.kind === 'pass') passes += amt; else packs += amt;
      });
      return [{ label: 'Subscriptions', value: subs }, { label: 'Naira passes', value: passes }, { label: 'Token packs', value: packs }, { label: 'Expansions', value: exp }].filter(x => x.value > 0);
    };
    const arpu = perHead(total, a.users.length);
    const arppu = perHead(total, paidUsers);
    const ltv: CurrencySums = { USD: arppu.USD * 12, NGN: arppu.NGN * 12 }; // rough: ARPPU annualized
    // period revenue
    const now = Date.now();
    const sumSince = (ms: number) => sumByCurrency(views.filter(v => v.date && now - v.date.getTime() <= ms));
    const day = 86400000;
    const periods = { daily: sumSince(day), weekly: sumSince(7 * day), monthly: sumSince(30 * day), quarterly: sumSince(90 * day), annual: sumSince(365 * day) };
    const refundedRaw = sumByCurrency(views.filter(v => v.amountMinor < 0));
    const refunded: CurrencySums = { USD: Math.abs(refundedRaw.USD), NGN: Math.abs(refundedRaw.NGN) };
    // daily revenue series, one per currency (major units for the chart)
    const seriesFor = (c: PayCurrency) => {
      const sums: Record<string, number> = {};
      views.forEach(v => { if (!v.date || v.currency !== c) return; const k = `${v.date.getMonth() + 1}/${v.date.getDate()}`; sums[k] = (sums[k] || 0) + v.amountMinor / 100; });
      return bucketByDay([], 14).map(b => ({ label: b.label, value: sums[b.label] || 0 }));
    };
    const series = { USD: seriesFor('USD'), NGN: seriesFor('NGN') };
    const sources = { USD: bySource('USD'), NGN: bySource('NGN') };
    // churn
    const cancelled = a.users.filter(u => u.subscription_status === 'cancelled').length;
    const expired = a.users.filter(u => u.subscription_status === 'expired').length;
    const churnRate = (activePro + cancelled + expired) ? Math.round(((cancelled + expired) / (activePro + cancelled + expired)) * 100) : 0;
    return { total, mrr, arr: mrr * 12, arpu, arppu, ltv, series, periods, refunded, byPlan, sources, cancelled, expired, churnRate };
  }, [a.payments, a.users]);

  const columns: Column<PaymentRecord>[] = [
    { key: 'date', header: 'Date', render: p => <span className="text-xs text-gray-600">{fmtDate(p.created_at)}</span> },
    { key: 'user', header: 'User', render: p => <span className="text-xs font-bold text-[#0B0B0B] truncate block max-w-[160px]">{p.uid}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: p => { const v = paymentView(p); return <span className={`text-sm font-black ${v.amountMinor < 0 ? 'text-red-500' : 'text-green-600'}`}>{v.display}</span>; } },
    { key: 'tokens', header: 'Tokens', align: 'right', render: p => <span className="text-xs font-bold text-gray-600">+{p.tokens_credited}</span> },
    { key: 'status', header: 'Status', align: 'right', render: p => <Pill tone={p.status === 'failed' ? 'red' : 'green'}>{p.status || 'completed'}</Pill> },
  ];

  return (
    <div className="space-y-12">
      <AdminSectionHeader title="Revenue" subtitle="Recurring revenue, per-user economics, and the transaction ledger."
        actions={a.payments.length > 0 ? <button onClick={() => downloadAsCSV('MarketBrainOS_Revenue', paymentsToCSV(a.payments))} className="px-5 py-2.5 rounded-xl bg-white/5 border border-gray-800 text-gray-300 text-[10px] font-bold uppercase tracking-widest hover:text-white">Export CSV</button> : undefined} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
        <KpiCard label="Daily" value={<CurrencyPair sums={d.periods.daily} />} accent />
        <KpiCard label="Weekly" value={<CurrencyPair sums={d.periods.weekly} />} />
        <KpiCard label="Monthly" value={<CurrencyPair sums={d.periods.monthly} />} />
        <KpiCard label="Quarterly" value={<CurrencyPair sums={d.periods.quarterly} />} />
        <KpiCard label="Annual" value={<CurrencyPair sums={d.periods.annual} />} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
        <KpiCard label="Total Revenue" value={<CurrencyPair sums={d.total} />} tone="good" />
        <KpiCard label="MRR / ARR" value={money(d.mrr)} hint={`ARR ${money(d.arr)}`} />
        <KpiCard label="ARPU / ARPPU" value={<CurrencyPair sums={d.arpu} />} hint={`ARPPU ${formatSums(d.arppu)}`} />
        <KpiCard label="Est. LTV" value={<CurrencyPair sums={d.ltv} />} />
        <KpiCard label="Refunded" value={<CurrencyPair sums={d.refunded} />} tone={d.refunded.USD || d.refunded.NGN ? 'danger' : 'default'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Revenue (14d)">
          {CURRENCIES.map(c => (
            <div key={c} className="first:mb-6">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">{c}</p>
              <LineChart data={d.series[c]} height={80} valueFormat={chartFormat(c)} />
            </div>
          ))}
        </Card>
        <Card title="MRR by Plan">{d.byPlan.length ? <DonutChart data={d.byPlan} /> : <p className="text-sm text-gray-400 py-8 text-center font-medium">No recurring revenue yet.</p>}</Card>
        <Card title="Revenue by Source">
          {d.sources.USD.length || d.sources.NGN.length ? CURRENCIES.filter(c => d.sources[c].length).map(c => (
            <div key={c} className="first:mb-6">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">{c}</p>
              <DonutChart data={d.sources[c]} size={120} />
            </div>
          )) : <p className="text-sm text-gray-400 py-8 text-center font-medium">No revenue yet.</p>}
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="Churn Rate" value={`${d.churnRate}%`} tone={d.churnRate > 10 ? 'danger' : 'default'} />
        <KpiCard label="Cancelled" value={d.cancelled} />
        <KpiCard label="Expired" value={d.expired} />
        <KpiCard label="Active Subs" value={a.users.filter(u => u.subscription_status === 'active').length} tone="good" />
      </div>

      <AdminTable rows={a.payments} columns={columns} searchKeys={[p => p.uid, p => paymentView(p).reference]} searchPlaceholder="Search transactions…" empty="No transactions yet." />
    </div>
  );
};

export default Revenue;
