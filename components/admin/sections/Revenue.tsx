// Revenue — MRR/ARR/ARPU/LTV and the transaction ledger, from the payments collection.

import React, { useMemo } from 'react';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, AdminTable, KpiCard, Pill, Column } from '../primitives';
import { LineChart, bucketByDay } from '../Charts';
import { downloadAsCSV, paymentsToCSV } from '../../../services/exportService';
import { PaymentRecord } from '../../../types';
import { fmtDate, money, tsToMillis } from '../util';

const Revenue: React.FC = () => {
  const a = useAdmin();

  const d = useMemo(() => {
    const total = a.payments.reduce((s, p) => s + (Number(p.amount_paid) || 0), 0);
    const activePro = a.users.filter(u => u.subscription_status === 'active').length;
    const mrr = activePro * 7;
    const arpu = a.users.length ? total / a.users.length : 0;
    const ltv = arpu * 12; // rough: ARPU annualized
    // daily revenue series
    const sums: Record<string, number> = {};
    a.payments.forEach(p => { const t = tsToMillis(p.created_at); if (!t) return; const dt = new Date(t); const k = `${dt.getMonth() + 1}/${dt.getDate()}`; sums[k] = (sums[k] || 0) + (Number(p.amount_paid) || 0); });
    const series = bucketByDay(a.payments.map(p => tsToMillis(p.created_at)).filter(Boolean) as number[], 14).map(b => ({ label: b.label, value: sums[b.label] || 0 }));
    return { total, mrr, arr: mrr * 12, arpu, ltv, series };
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
        <KpiCard label="Total Revenue" value={money(d.total)} accent tone="good" />
        <KpiCard label="MRR" value={money(d.mrr)} />
        <KpiCard label="ARR" value={money(d.arr)} />
        <KpiCard label="ARPU" value={money(d.arpu)} />
        <KpiCard label="Est. LTV" value={money(d.ltv)} />
      </div>

      <Card title="Revenue (14d)"><LineChart data={d.series} valueFormat={money} /></Card>

      <AdminTable rows={a.payments} columns={columns} searchKeys={[p => p.uid, p => p.payment_reference || '']} searchPlaceholder="Search transactions…" empty="No transactions yet." />
    </div>
  );
};

export default Revenue;
