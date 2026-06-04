// Subscription Management — plan breakdown, MRR/ARR, and a per-user subscription table. Plan
// changes use the existing flow; promotional/trial grants arrive with the new admin functions.

import React, { useMemo } from 'react';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, AdminTable, KpiCard, Pill, ComingSoon, Column } from '../primitives';
import { DonutChart } from '../Charts';
import { UserProfile } from '../../../types';
import { fmtDate, money } from '../util';

const Subscriptions: React.FC = () => {
  const a = useAdmin();

  const stats = useMemo(() => {
    const by: Record<string, number> = { free: 0, pro: 0, team: 0, agency: 0, enterprise: 0 };
    a.users.forEach(u => { by[u.tier] = (by[u.tier] || 0) + 1; });
    const activePro = a.users.filter(u => u.subscription_status === 'active').length;
    const cancelled = a.users.filter(u => u.subscription_status === 'cancelled').length;
    const mrr = activePro * 7;
    return { by, activePro, cancelled, mrr, arr: mrr * 12, paid: a.users.length - by.free };
  }, [a.users]);

  const changePlan = (u: UserProfile) => a.confirm({
    type: 'changePlan', userId: u.id, payload: { plan: u.tier === 'free' ? 'pro' : 'free' },
    warningTitle: 'CHANGE TIER', warningMessage: `Switch ${u.email} to ${u.tier === 'free' ? 'PRO' : 'FREE'}.`, keyword: 'CONFIRM',
  });

  const columns: Column<UserProfile>[] = [
    { key: 'user', header: 'User', render: u => <span className="text-sm font-bold text-[#0B0B0B]">{u.email}</span> },
    { key: 'plan', header: 'Plan', render: u => <Pill tone={u.tier === 'free' ? 'gray' : 'red'}>{u.tier}</Pill> },
    { key: 'status', header: 'Status', render: u => <Pill tone={u.subscription_status === 'active' ? 'green' : u.subscription_status === 'past_due' ? 'yellow' : 'gray'}>{u.subscription_status || 'free'}</Pill> },
    { key: 'renews', header: 'Renews', render: u => <span className="text-xs text-gray-500">{fmtDate(u.plan_renews_at)}</span> },
    { key: 'actions', header: 'Actions', align: 'right', render: u => <button onClick={() => changePlan(u)} disabled={a.isEmergencyActive} className="text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:text-[#0B0B0B] disabled:opacity-30">{u.tier === 'free' ? 'Upgrade' : 'Downgrade'}</button> },
  ];

  return (
    <div className="space-y-12">
      <AdminSectionHeader title="Subscriptions" subtitle="Plans, recurring revenue, and lifecycle across the platform." />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
        <KpiCard label="Active Subs" value={stats.activePro} accent />
        <KpiCard label="Free Users" value={stats.by.free} />
        <KpiCard label="Cancelled" value={stats.cancelled} />
        <KpiCard label="MRR" value={money(stats.mrr)} tone="good" />
        <KpiCard label="ARR" value={money(stats.arr)} tone="good" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Plan Breakdown">
          <DonutChart data={Object.entries(stats.by).filter(([, v]) => v > 0).map(([label, value]) => ({ label, value }))} />
        </Card>
        <Card title="Promotional Access">
          <p className="text-sm text-gray-500 font-medium mb-6">Grant trials and promotional durations (7/14/30/60/90 days).</p>
          <ComingSoon title="Grant Trial / Promo" description="Enabled by the new admin subscription function (deploy required)." />
        </Card>
      </div>

      <AdminTable rows={a.users.filter(u => u.tier !== 'free')} columns={columns}
        searchKeys={[u => u.email]} searchPlaceholder="Search subscribers…" empty="No paid subscribers yet." />
    </div>
  );
};

export default Subscriptions;
