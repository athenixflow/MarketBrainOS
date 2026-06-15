// Revenue — MRR/ARR/ARPU/LTV and the transaction ledger, from the payments collection.

import React, { useMemo } from 'react';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, AdminTable, KpiCard, Pill, Column } from '../primitives';
import { LineChart, DonutChart, bucketByDay } from '../Charts';
import { downloadAsCSV, paymentsToCSV } from '../../../services/exportService';
import { PaymentRecord } from '../../../types';
import { fmtDate, money, tsToMillis } from '../util';
import { DEFAULT_PRICING_CONFIG, PLAN_META, Tier } from '../../../config/pricingConfig';

const Revenue: React.FC = () => {
  const a = useAdmin();

  const d = useMemo(() => {
    const total = a.payments.reduce((s, p) => s + (Number(p.amount_paid) || 0), 0);
    const paidUsers = a.users.filter(u => u.tier !== 'free').length;
    const activePro = a.users.filter(u => u.subscription_status === 'active').length;
    // MRR by plan from the config prices (all paid tiers, not just Pro).
    const paidTiers: Tier[] = ['pro', 'team', 'agency', 'enterprise'];
    const byPlan = paidTiers
      .map(t => ({ label: PLAN_META[t].name, value: a.users.filter(u => u.tier === t).length * (DEFAULT_PRICING_CONFIG.plans[t].price || 0) }))
      .filter(x => x.value > 0);
    const mrr = byPlan.reduce((s, x) => s + x.value, 0);
    // Revenue by source from the payments ledger (subscriptions vs token packs vs expansions).
    const bySource = (() => {
      let subs = 0, packs = 0, exp = 0;
      a.payments.forEach(p => { const amt = Number(p.amount_paid) || 0; const t = (p as any).type; if (t === 'expansion') exp += amt; else if (t === 'subscription') subs += amt; else packs += amt; });
      return [{ label: 'Subscriptions', value: subs }, { label: 'Token packs', value: packs }, { label: 'Expansions', value: exp }].filter(x => x.value > 0);
    })();
    const arpu = a.users.length ? total / a.users.length : 0;
    const arppu = paidUsers ? total / paidUsers : 0;
    const ltv = arppu * 12; // rough: ARPPU annualized
    // period revenue
    const now = Date.now();
    const sumSince = (ms: number) => a.payments.reduce((s, p) => { const t = tsToMillis(p.created_at); return t && now - t <= ms ? s + (Number(p.amount_paid) || 0) : s; }, 0);
    const day = 86400000;
    const periods = { daily: sumSince(day), weekly: sumSince(7 * day), monthly: sumSince(30 * day), quarterly: sumSince(90 * day), annual: sumSince(365 * day) };
    const refunded = a.payments.filter(p => (Number(p.amount_paid) || 0) < 0).reduce((s, p) => s + Math.abs(Number(p.amount_paid) || 0), 0);
    // daily revenue series
    const sums: Record<string, number> = {};
    a.payments.forEach(p => { const t = tsToMillis(p.created_at); if (!t) return; const dt = new Date(t); const k = `${dt.getMonth() + 1}/${dt.getDate()}`; sums[k] = (sums[k] || 0) + (Number(p.amount_paid) || 0); });
    const series = bucketByDay(a.payments.map(p => tsToMillis(p.created_at)).filter(Boolean) as number[], 14).map(b => ({ label: b.label, value: sums[b.label] || 0 }));
    // churn
    const cancelled = a.users.filter(u => u.subscription_status === 'cancelled').length;
    const expired = a.users.filter(u => u.subscription_status === 'expired').length;
    const churnRate = (activePro + cancelled + expired) ? Math.round(((cancelled + expired) / (activePro + cancelled + expired)) * 100) : 0;
    return { total, mrr, arr: mrr * 12, arpu, arppu, ltv, series, periods, refunded, byPlan, bySource, cancelled, expired, churnRate };
  }, [a.payments, a.users]);

  const columns: Column<PaymentRecord>[] = [
    { key: 'date', header: 'Date', render: p => <span className="text-xs text-gray-600">{fmtDate(p.created_at)}</span> },
    { key: 'user', header: 'User', render: p => <span className="text-xs font-bold text-[#0B0B0B] truncate block max-w-[160px]">{p.uid}</span> },
    { key: 'amount', header: 'Amount', render: p => <span className="text-sm font-black text-green-600">{money(Number(p.amount_paid) || 0)}</span> },
    { key: 'tokens', header: 'Tokens', render: p => <span className="text-xs font-bold text-gray-600">+{p.tokens_credited}</span> },
    { key: 'status', header: 'Status', align: 'right', render: p => <Pill tone={p.status === 'failed' ? 'red' : 'green'}>{p.status || 'completed'}</Pill> },
  ];

  return (
    <div className="space-y-12">
      <AdminSectionHeader title="Revenue" subtitle="Recurring revenue, per-user economics, and the transaction ledger."
        actions={a.payments.length > 0 ? <button onClick={() => downloadAsCSV('MarketBrainOS_Revenue', paymentsToCSV(a.payments))} className="px-5 py-2.5 rounded-xl bg-white/5 border border-gray-800 text-gray-300 text-[10px] font-bold uppercase tracking-widest hover:text-white">Export CSV</button> : undefined} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
        <KpiCard label="Daily" value={money(d.periods.daily)} accent />
        <KpiCard label="Weekly" value={money(d.periods.weekly)} />
        <KpiCard label="Monthly" value={money(d.periods.monthly)} />
        <KpiCard label="Quarterly" value={money(d.periods.quarterly)} />
        <KpiCard label="Annual" value={money(d.periods.annual)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
        <KpiCard label="Total Revenue" value={money(d.total)} tone="good" />
        <KpiCard label="MRR / ARR" value={money(d.mrr)} hint={`ARR ${money(d.arr)}`} />
        <KpiCard label="ARPU / ARPPU" value={money(d.arpu)} hint={`ARPPU ${money(d.arppu)}`} />
        <KpiCard label="Est. LTV" value={money(d.ltv)} />
        <KpiCard label="Refunded" value={money(d.refunded)} tone={d.refunded ? 'danger' : 'default'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Revenue (14d)"><LineChart data={d.series} valueFormat={money} /></Card>
        <Card title="MRR by Plan">{d.byPlan.length ? <DonutChart data={d.byPlan} /> : <p className="text-sm text-gray-400 py-8 text-center font-medium">No recurring revenue yet.</p>}</Card>
        <Card title="Revenue by Source">{d.bySource.length ? <DonutChart data={d.bySource} /> : <p className="text-sm text-gray-400 py-8 text-center font-medium">No revenue yet.</p>}</Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="Churn Rate" value={`${d.churnRate}%`} tone={d.churnRate > 10 ? 'danger' : 'default'} />
        <KpiCard label="Cancelled" value={d.cancelled} />
        <KpiCard label="Expired" value={d.expired} />
        <KpiCard label="Active Subs" value={a.users.filter(u => u.subscription_status === 'active').length} tone="good" />
      </div>

      <AdminTable rows={a.payments} columns={columns} searchKeys={[p => p.uid, p => p.payment_reference || '']} searchPlaceholder="Search transactions…" empty="No transactions yet." />
    </div>
  );
};

export default Revenue;
