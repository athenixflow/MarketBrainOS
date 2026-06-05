// Subscription Management — plan breakdown, MRR/ARR, and a per-user subscription table. Admins set
// any tier (free/pro/team/agency/enterprise) inline via adminManageSubscription; trials are granted
// per-user from the User detail page.

import React, { useMemo } from 'react';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, AdminTable, KpiCard, Pill, Column } from '../primitives';
import { DonutChart } from '../Charts';
import { UserProfile, UserTier } from '../../../types';
import { callAdminManageSubscription } from '../../../services/persistenceService';
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

  const changePlan = (u: UserProfile, plan: UserTier) => a.confirm({
    scope: 'admin:user_management', keyword: 'CONFIRM', warningTitle: 'SET PLAN',
    warningMessage: `Set ${u.email}'s subscription to ${plan.toUpperCase()}.${plan !== 'free' ? ' Status → active, renewal in 30 days.' : ''}`,
    run: async () => { await callAdminManageSubscription('changePlan', u.id!, { plan }); },
  });

  const columns: Column<UserProfile>[] = [
    { key: 'user', header: 'User', render: u => <span className="text-sm font-bold text-[#0B0B0B]">{u.email}</span> },
    { key: 'plan', header: 'Plan', render: u => <Pill tone={u.tier === 'free' ? 'gray' : 'red'}>{u.tier}</Pill> },
    { key: 'status', header: 'Status', render: u => <Pill tone={u.subscription_status === 'active' ? 'green' : u.subscription_status === 'past_due' ? 'yellow' : 'gray'}>{u.subscription_status || 'free'}</Pill> },
    { key: 'renews', header: 'Renews', render: u => <span className="text-xs text-gray-500">{fmtDate(u.plan_renews_at)}</span> },
    { key: 'actions', header: 'Set plan', align: 'right', render: u => (
      <select value={u.tier} disabled={a.isEmergencyActive}
        onChange={e => { const plan = e.target.value as UserTier; if (plan !== u.tier) changePlan(u, plan); }}
        className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-200 outline-none hover:text-[#0B0B0B] disabled:opacity-30">
        <option value="free">Free</option><option value="pro">Pro</option><option value="team">Team</option><option value="agency">Agency</option><option value="enterprise">Enterprise</option>
      </select>
    ) },
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
          <p className="text-sm text-gray-500 font-medium mb-4">Change any user's plan inline from the table below — Free, Pro, Team, Agency, or Enterprise. Each change is audited.</p>
          <p className="text-sm text-gray-500 font-medium">To grant a time-limited Pro trial (7/14/30/60/90 days), open the user from the Users section and use <span className="font-bold text-[#0B0B0B]">Grant Trial</span> on their profile.</p>
        </Card>
      </div>

      <AdminTable rows={a.users.filter(u => u.tier !== 'free')} columns={columns}
        searchKeys={[u => u.email]} searchPlaceholder="Search subscribers…" empty="No paid subscribers yet." />
    </div>
  );
};

export default Subscriptions;
