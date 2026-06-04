// Transactions — the full payments ledger with per-transaction actions (view customer, refund,
// export). Refunds route through the confirm/step-up flow into adminRefund, gated by capability.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, AdminTable, KpiCard, Pill, Column } from '../primitives';
import { adminCan } from '../../../config/adminAccess';
import { callAdminRefund } from '../../../services/persistenceService';
import { downloadAsCSV, paymentsToCSV } from '../../../services/exportService';
import { PaymentRecord } from '../../../types';
import { fmtDate, money } from '../util';

const Transactions: React.FC = () => {
  const a = useAdmin();
  const navigate = useNavigate();
  const canRefund = adminCan(a.profile?.role, 'refund', 'approve');

  const total = a.payments.reduce((s, p) => s + (Number(p.amount_paid) || 0), 0);
  const failed = a.payments.filter(p => p.status === 'failed').length;

  const refund = (p: PaymentRecord) => a.confirm({
    scope: 'admin:system_config', keyword: 'REFUND',
    warningTitle: 'ISSUE REFUND', warningMessage: `Refund ${money(Number(p.amount_paid) || 0)} to ${p.uid}. This is recorded in the ledger and audited.`,
    run: async () => { await callAdminRefund({ paymentId: p.id, uid: p.uid, amount: Number(p.amount_paid) || 0, reason: 'Admin-issued refund' }); },
  });

  const columns: Column<PaymentRecord>[] = [
    { key: 'date', header: 'Date', render: p => <span className="text-xs text-gray-600">{fmtDate(p.created_at)}</span> },
    { key: 'user', header: 'Customer', render: p => <button onClick={() => navigate(`/admin/users/${p.uid}`)} className="text-xs font-bold text-[#0B0B0B] hover:text-[#FF0000] truncate block max-w-[160px] text-left">{p.uid}</button> },
    { key: 'amount', header: 'Amount', render: p => <span className={`text-sm font-black ${(Number(p.amount_paid) || 0) < 0 ? 'text-red-500' : 'text-green-600'}`}>{money(Number(p.amount_paid) || 0)}</span> },
    { key: 'provider', header: 'Provider', render: p => <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{p.provider || 'stripe'}</span> },
    { key: 'status', header: 'Status', render: p => <Pill tone={p.status === 'failed' ? 'red' : p.status === 'pending' ? 'yellow' : 'green'}>{p.status || 'completed'}</Pill> },
    { key: 'actions', header: 'Actions', align: 'right', render: p => (
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => navigate(`/admin/users/${p.uid}`)} className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:text-[#0B0B0B]">Customer</button>
        {canRefund && (Number(p.amount_paid) || 0) > 0 && <button onClick={() => refund(p)} className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500">Refund</button>}
      </div>
    ) },
  ];

  return (
    <div className="space-y-12">
      <AdminSectionHeader title="Transactions" subtitle="Every payment across the platform."
        actions={a.payments.length > 0 ? <button onClick={() => downloadAsCSV('MarketBrainOS_Transactions', paymentsToCSV(a.payments))} className="px-5 py-2.5 rounded-xl bg-white/5 border border-gray-800 text-gray-300 text-[10px] font-bold uppercase tracking-widest hover:text-white">Export CSV</button> : undefined} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="Transactions" value={a.payments.length} accent />
        <KpiCard label="Gross Volume" value={money(total)} tone="good" />
        <KpiCard label="Failed" value={failed} tone={failed ? 'danger' : 'default'} />
        <KpiCard label="Provider" value="Stripe" />
      </div>
      <AdminTable rows={a.payments} columns={columns} searchKeys={[p => p.uid, p => p.payment_reference || '']} searchPlaceholder="Search by customer or reference…" empty="No transactions yet." />
    </div>
  );
};

export default Transactions;
