// Token Management — balances, consumption by tool, and purchase totals. Arbitrary add/remove/refund
// adjustments arrive with the new admin token function (deploy required).

import React, { useMemo } from 'react';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, AdminTable, KpiCard, ComingSoon, Column, SampledNote } from '../primitives';
import { BarChart } from '../Charts';
import { UserProfile } from '../../../types';

const Tokens: React.FC = () => {
  const a = useAdmin();

  const derived = useMemo(() => {
    const balances = a.users.reduce((n, u) => n + (Number(u.tokens) || 0), 0);
    const purchased = a.payments.reduce((n, p) => n + (Number(p.tokens_credited) || 0), 0);
    const consumed = a.platformStats?.tokensConsumed || 0;
    const refunded = a.actionLogs.filter(l => l.status === 'failed_refunded').length;
    const byTool = new Map<string, number>();
    a.actionLogs.forEach(l => { if (l.module && l.tokens_used) byTool.set(l.module, (byTool.get(l.module) || 0) + l.tokens_used); });
    const toolUsage = [...byTool.entries()].map(([label, value]) => ({ label, value })).sort((x, y) => y.value - x.value).slice(0, 8);
    return { balances, purchased, consumed, refunded, toolUsage };
  }, [a.users, a.payments, a.actionLogs, a.platformStats]);

  const columns: Column<UserProfile>[] = [
    { key: 'user', header: 'User', render: u => <span className="text-sm font-bold text-[#0B0B0B]">{u.email}</span> },
    { key: 'tier', header: 'Plan', render: u => <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{u.tier}</span> },
    { key: 'balance', header: 'Balance', align: 'right', render: u => <span className="text-sm font-black text-[#0B0B0B]">{u.tokens}</span> },
  ];

  return (
    <div className="space-y-12">
      <AdminSectionHeader title="Tokens" subtitle="The platform token economy — balances, consumption, and purchases." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="Active Balances" value={derived.balances} accent />
        <KpiCard label="Tokens Purchased" value={derived.purchased} tone="good" />
        <KpiCard label="Tokens Consumed" value={derived.consumed} />
        <KpiCard label="Refund Events" value={derived.refunded} tone={derived.refunded ? 'danger' : 'default'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Consumption by Tool · recent sample"><div className="mb-4"><SampledNote n={a.metrics.sampleSize} /></div><BarChart data={derived.toolUsage} /></Card>
        <Card title="Manual Adjustments">
          <p className="text-sm text-gray-500 font-medium mb-6">Add, remove, refund, or grant bonus tokens with a reason (fully audited).</p>
          <div className="space-y-3">
            <ComingSoon title="Add / Remove / Refund Tokens" description="Enabled by the new adminManageTokens function (deploy required)." />
            <ComingSoon title="Bonus & Compensation Grants" description="Promotional, support, and contest token grants." />
          </div>
        </Card>
      </div>

      <AdminTable rows={[...a.users].sort((x, y) => (y.tokens || 0) - (x.tokens || 0))} columns={columns}
        searchKeys={[u => u.email]} searchPlaceholder="Search balances…" empty="No users." />
    </div>
  );
};

export default Tokens;
