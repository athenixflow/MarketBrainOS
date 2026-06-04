// Platform Overview — executive dashboard: KPI cards, growth charts, activity feed, insights,
// quick actions, and a global search. All derived client-side from the data the AdminProvider
// already loaded (users, payments, action logs, platform stats) — no extra backend.

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { KpiCard, AdminSectionHeader, Pill } from '../primitives';
import { LineChart, BarChart, cumulativeByDay, bucketByDay } from '../Charts';
import { tsToMillis } from '../util';
import GlobalSearch from '../GlobalSearch';

const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const Overview: React.FC = () => {
  const a = useAdmin();
  const navigate = useNavigate();

  const derived = useMemo(() => {
    const proUsers = a.users.filter(u => u.tier === 'pro' || (u.subscription_status === 'active'));
    const activePro = a.users.filter(u => u.subscription_status === 'active').length;
    const revenueTotal = a.payments.reduce((s, p) => s + (Number(p.amount_paid) || 0), 0);
    const mrr = activePro * 7; // Pro = $7/mo
    const arr = mrr * 12;
    const newToday = a.users.filter(u => {
      const t = tsToMillis((u as any).created_at);
      return t && (Date.now() - t) < 86400000;
    }).length;

    // Growth series (last 14 days)
    const userTs = a.users.map(u => tsToMillis((u as any).created_at)).filter(Boolean) as number[];
    const payTs = a.payments.map(p => tsToMillis(p.created_at)).filter(Boolean) as number[];
    const analysisTs = a.actionLogs.map(l => l.created_at ? l.created_at.toMillis() : new Date(l.timestamp || 0).getTime()).filter(Boolean);

    const userGrowth = cumulativeByDay(userTs, 14, Math.max(0, a.users.length - userTs.length));
    const revenueByDay = (() => {
      const days = bucketByDay(payTs, 14);
      // map count→sum is approximate; recompute sums per day
      const sums: Record<string, number> = {};
      a.payments.forEach(p => {
        const t = tsToMillis(p.created_at); if (!t) return;
        const d = new Date(t); const key = `${d.getMonth() + 1}/${d.getDate()}`;
        sums[key] = (sums[key] || 0) + (Number(p.amount_paid) || 0);
      });
      return days.map(d => ({ label: d.label, value: sums[d.label] || 0 }));
    })();
    const analysisGrowth = bucketByDay(analysisTs, 14);

    // Most used tool (from action logs)
    const moduleCounts = new Map<string, number>();
    a.actionLogs.forEach(l => { if (l.module) moduleCounts.set(l.module, (moduleCounts.get(l.module) || 0) + 1); });
    const topModules = [...moduleCounts.entries()].map(([label, value]) => ({ label, value })).sort((x, y) => y.value - x.value).slice(0, 6);

    return { activePro, revenueTotal, mrr, arr, newToday, userGrowth, revenueByDay, analysisGrowth, topModules, proCount: proUsers.length };
  }, [a.users, a.payments, a.actionLogs]);

  const recentActivity = useMemo(() => {
    const items: { kind: string; label: string; ts: number; tone: any }[] = [];
    a.users.slice(0, 8).forEach(u => { const t = tsToMillis((u as any).created_at); if (t) items.push({ kind: 'User', label: u.email, ts: t, tone: 'blue' }); });
    a.payments.slice(0, 8).forEach(p => items.push({ kind: 'Payment', label: `${money(Number(p.amount_paid) || 0)} • ${p.tokens_credited} tokens`, ts: tsToMillis(p.created_at) || 0, tone: 'green' }));
    a.actionLogs.slice(0, 10).forEach(l => items.push({ kind: 'Analysis', label: l.module || l.action || 'run', ts: l.created_at ? l.created_at.toMillis() : new Date(l.timestamp || 0).getTime(), tone: l.status === 'failed_refunded' ? 'red' : 'gray' }));
    return items.sort((x, y) => y.ts - x.ts).slice(0, 10);
  }, [a.users, a.payments, a.actionLogs]);

  const s = a.platformStats;
  const conv = a.users.length ? Math.round((derived.proCount / a.users.length) * 100) : 0;

  const quickActions = [
    { label: 'View Users', to: '/admin/users' },
    { label: 'View Revenue', to: '/admin/revenue' },
    { label: 'View Analyses', to: '/admin/analyses' },
    { label: 'Audit Logs', to: '/admin/audit' },
    { label: 'Security', to: '/admin/security' },
    { label: 'Feature Flags', to: '/admin/flags' },
  ];

  return (
    <div className="space-y-12">
      <AdminSectionHeader title="Platform Overview" subtitle="Live health of the MarketBrain OS ecosystem — users, revenue, activity, and reliability at a glance." />

      {/* UNIFIED GLOBAL SEARCH */}
      <GlobalSearch />

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
        <KpiCard label="Total Users" value={s?.totalUsers ?? a.users.length} hint={`+${derived.newToday} today`} accent />
        <KpiCard label="Active (24h)" value={s?.activeUsers ?? 0} />
        <KpiCard label="Analyses" value={s?.totalAnalyses ?? 0} />
        <KpiCard label="Active Subs" value={derived.activePro} hint={`${conv}% conversion`} />
        <KpiCard label="MRR" value={money(derived.mrr)} hint={`ARR ${money(derived.arr)}`} tone="good" />
        <KpiCard label="Tokens Used" value={s?.tokensConsumed ?? 0} />
      </div>

      {/* GROWTH CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="User Growth (14d)"><LineChart data={derived.userGrowth} /></Card>
        <Card title="Revenue (14d)"><LineChart data={derived.revenueByDay} valueFormat={money} /></Card>
        <Card title="Analyses (14d)"><LineChart data={derived.analysisGrowth} /></Card>
        <Card title="Top Tools by Volume"><BarChart data={derived.topModules} /></Card>
      </div>

      {/* INSIGHTS + ACTIVITY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Platform Insights">
          <div className="space-y-4 text-sm">
            <Insight label="Most used tool" value={derived.topModules[0]?.label || '—'} />
            <Insight label="Conversion (free→paid)" value={`${conv}%`} />
            <Insight label="Total lifetime revenue" value={money(derived.revenueTotal)} />
            <Insight label="ARPU" value={a.users.length ? money(derived.revenueTotal / a.users.length) : '$0'} />
            <Insight label="Failure rate (24h)" value={`${a.failureRate.toFixed(1)}%`} />
          </div>
        </Card>
        <Card title="Recent Activity">
          {recentActivity.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center font-medium">No activity yet.</p> : (
            <div className="divide-y divide-gray-50">
              {recentActivity.map((it, i) => (
                <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <Pill tone={it.tone}>{it.kind}</Pill>
                    <span className="text-xs font-bold text-[#0B0B0B] truncate">{it.label}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">{it.ts ? new Date(it.ts).toLocaleDateString() : ''}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mb-4">Quick Actions</p>
        <div className="flex flex-wrap gap-3">
          {quickActions.map(qa => (
            <button key={qa.to} onClick={() => navigate(qa.to)}
              className="px-6 py-3 rounded-xl bg-white/5 border border-gray-800 text-gray-300 text-[10px] font-bold uppercase tracking-widest hover:text-white hover:border-gray-600 transition-all">{qa.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

const Insight: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-gray-500 font-medium">{label}</span>
    <span className="font-black text-[#0B0B0B]">{value}</span>
  </div>
);

export default Overview;
