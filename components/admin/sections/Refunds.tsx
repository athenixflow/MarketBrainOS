// Refund Center — issue refunds and review the refund ledger. Refunds are admin-initiated and
// recorded in payments (negative amount / refunded status); a user-submitted refund-request queue
// is a documented follow-up.

import React, { useMemo, useState } from 'react';
import { Card, PrimaryButton } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, AdminTable, KpiCard, Pill, ComingSoon, Column, CurrencyPair } from '../primitives';
import { adminCan } from '../../../config/adminAccess';
import { callAdminRefund } from '../../../services/persistenceService';
import { PayCurrency, formatMinor, parseMajor, paymentView, sumByCurrency } from '../../../services/payments';
import { PaymentRecord } from '../../../types';
import { fmtDate } from '../util';

const Refunds: React.FC = () => {
  const a = useAdmin();
  const canRefund = adminCan(a.profile?.role, 'refund', 'approve');
  const [uid, setUid] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<PayCurrency>('USD');
  const [reason, setReason] = useState('');

  const refunds = useMemo(() => a.payments.filter(p => { const v = paymentView(p); return v.amountMinor < 0 || p.status === 'failed' || v.kind === 'refund'; }), [a.payments]);
  /* Per currency, through the payments adapter: ₦ is never added to $. */
  const refundedRaw = sumByCurrency(refunds.map(paymentView).filter(v => v.amountMinor < 0));
  const refundedTotal = { USD: Math.abs(refundedRaw.USD), NGN: Math.abs(refundedRaw.NGN) };

  const issue = () => {
    const amountMinor = parseMajor(amount);
    if (!uid.trim() || !amountMinor) return;
    a.confirm({
      scope: 'admin:system_config', keyword: 'REFUND',
      warningTitle: 'ISSUE REFUND', warningMessage: `Refund ${formatMinor(amountMinor, currency)} to ${uid}.`,
      run: async () => { await callAdminRefund({ uid: uid.trim(), amountMinor, currency, reason }); setUid(''); setAmount(''); setReason(''); },
    });
  };

  const columns: Column<PaymentRecord>[] = [
    { key: 'date', header: 'Date', render: p => <span className="text-xs text-gray-600">{fmtDate(p.created_at)}</span> },
    { key: 'user', header: 'User', render: p => <span className="text-xs font-bold text-[#0B0B0B] truncate block max-w-[160px]">{p.uid}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: p => { const v = paymentView(p); return <span className="text-sm font-black text-red-500">{formatMinor(Math.abs(v.amountMinor), v.currency)}</span>; } },
    { key: 'ref', header: 'Reference', render: p => <span className="text-xs font-mono text-gray-500 truncate block max-w-[160px]">{paymentView(p).reference || '—'}</span> },
    { key: 'status', header: 'Status', align: 'right', render: p => <Pill tone="red">{p.status || 'refunded'}</Pill> },
  ];

  return (
    <div className="space-y-12">
      <AdminSectionHeader title="Refund Center" subtitle="Issue refunds and review the refund ledger." />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        <KpiCard label="Refund Records" value={refunds.length} accent />
        <KpiCard label="Refunded Total" value={<CurrencyPair sums={refundedTotal} />} tone="danger" />
        <KpiCard label="Provider" value="Recorded only" hint="Send the money back in the Bachs dashboard" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Issue a Refund">
          {canRefund ? (
            <>
              <input value={uid} onChange={e => setUid(e.target.value)} placeholder="User ID" className="w-full bg-[#FBFBFB] border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#0B0B0B] outline-none mb-3" />
              <div className="flex gap-3 mb-3">
                <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder={`Amount (${currency})`} className="flex-1 min-w-0 bg-[#FBFBFB] border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#0B0B0B] outline-none" />
                <select value={currency} onChange={e => setCurrency(e.target.value as PayCurrency)} aria-label="Refund currency" className="bg-[#FBFBFB] border border-gray-200 rounded-xl px-3 py-3 text-sm text-[#0B0B0B] outline-none">
                  <option value="USD">USD</option>
                  <option value="NGN">NGN</option>
                </select>
              </div>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (audited)" className="w-full bg-[#FBFBFB] border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#0B0B0B] outline-none mb-4" />
              <PrimaryButton onClick={issue} className="!px-6 !py-3 !text-xs">Issue Refund</PrimaryButton>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-3">Requires the new admin refund function to be deployed.</p>
            </>
          ) : <p className="text-sm text-gray-400 font-medium py-6 text-center">Refund approval requires elevated clearance.</p>}
        </Card>
        <Card title="Refund Requests">
          <ComingSoon title="User-submitted refund queue" description="Approve/reject requests initiated by users (needs a refund-request flow)." />
        </Card>
      </div>

      <AdminTable rows={refunds} columns={columns} searchKeys={[p => p.uid, p => paymentView(p).reference]} searchPlaceholder="Search refunds…" empty="No refunds recorded." />
    </div>
  );
};

export default Refunds;
