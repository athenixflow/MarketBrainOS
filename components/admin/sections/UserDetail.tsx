// User detail — profile, account, plan/tokens, and (Phase C) activity timeline. Admin actions reuse
// the shared confirm/step-up flow.

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, PrimaryButton } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, KpiCard, Pill } from '../primitives';
import { getUserActionLogs, getUserPaymentHistory, callAdminManageTokens, callAdminManageSubscription, AdminTokenAction } from '../../../services/persistenceService';
import { ActionLogEntry, PaymentRecord } from '../../../types';
import { fmtDate, fmtDateTime } from '../util';

const UserDetail: React.FC = () => {
  const { uid } = useParams();
  const a = useAdmin();
  const navigate = useNavigate();
  const u = a.users.find(x => x.id === uid);

  const [logs, setLogs] = useState<ActionLogEntry[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [tokAction, setTokAction] = useState<AdminTokenAction>('add');
  const [tokAmount, setTokAmount] = useState('');
  const [tokReason, setTokReason] = useState('');
  const [trialDays, setTrialDays] = useState('14');

  useEffect(() => {
    if (!uid) return;
    getUserActionLogs(uid, 50).then(setLogs).catch(() => {});
    getUserPaymentHistory(uid).then(setPayments).catch(() => {});
  }, [uid]);

  if (!u) return (
    <div>
      <AdminSectionHeader title="User" actions={<button onClick={() => navigate('/admin/users')} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white">← Back</button>} />
      <Card><p className="text-gray-400 text-sm py-8 text-center font-medium">User not found in the loaded roster.</p></Card>
    </div>
  );

  const tokensUsed = logs.reduce((n, l) => n + (l.status !== 'failed_refunded' && l.tokens_used ? l.tokens_used : 0), 0);
  const totalPurchased = payments.reduce((n, p) => n + (Number(p.tokens_credited) || 0), 0);
  const moduleCounts = new Map<string, number>();
  logs.forEach(l => { if (l.module) moduleCounts.set(l.module, (moduleCounts.get(l.module) || 0) + 1); });
  const mostUsed = [...moduleCounts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] || '—';

  const changePlan = () => a.confirm({ type: 'changePlan', userId: u.id, payload: { plan: u.tier === 'free' ? 'pro' : 'free' }, warningTitle: 'CHANGE TIER', warningMessage: `Switch ${u.email} to ${u.tier === 'free' ? 'PRO' : 'FREE'}.`, keyword: 'CONFIRM' });
  const resetTokens = () => a.confirm({ type: 'resetTokens', userId: u.id, warningTitle: 'RESET TOKENS', warningMessage: `Reset ${u.email} to plan default.`, keyword: 'RESET' });
  const toggleStatus = () => a.confirm({ type: 'toggleStatus', userId: u.id, payload: { targetStatus: u.is_suspended ? 'active' : 'disabled' }, warningTitle: u.is_suspended ? 'RESTORE ACCESS' : 'DISABLE ACCESS', warningMessage: `${u.email}`, keyword: u.is_suspended ? 'RESTORE' : 'DISABLE' });

  const adjustTokens = () => {
    const amount = Number(tokAmount);
    if (tokAction !== 'reset' && (!amount || amount <= 0)) return;
    a.confirm({
      scope: 'admin:token_management', keyword: 'CONFIRM',
      warningTitle: `${tokAction.toUpperCase()} TOKENS`,
      warningMessage: `${tokAction === 'reset' ? 'Reset to plan default' : `${tokAction} ${amount} tokens`} for ${u.email}.`,
      run: async () => { await callAdminManageTokens(tokAction, u.id!, { amount, reason: tokReason }); setTokAmount(''); setTokReason(''); },
    });
  };
  const grantTrial = () => a.confirm({
    scope: 'admin:user_management', keyword: 'CONFIRM', warningTitle: 'GRANT TRIAL',
    warningMessage: `Grant ${u.email} a ${Number(trialDays) || 0}-day Pro trial.`,
    run: async () => { await callAdminManageSubscription('trial', u.id!, { days: Number(trialDays) || 0 }); },
  });
  const grantPro = () => a.confirm({
    scope: 'admin:user_management', keyword: 'CONFIRM', warningTitle: 'GRANT PRO',
    warningMessage: `Grant ${u.email} Pro access.`,
    run: async () => { await callAdminManageSubscription('grant', u.id!, { plan: 'pro' }); },
  });

  return (
    <div className="space-y-10">
      <AdminSectionHeader title={u.email} subtitle={`${u.tier.toUpperCase()} • ${u.role.replace('_', ' ')} • ${u.is_suspended ? 'Suspended' : 'Active'}`}
        actions={<button onClick={() => navigate('/admin/users')} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white">← Back to Users</button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <KpiCard label="Token Balance" value={u.tokens} accent />
        <KpiCard label="Tokens Used" value={tokensUsed} />
        <KpiCard label="Tokens Purchased" value={totalPurchased} />
        <KpiCard label="Analyses" value={logs.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Profile">
          <Row label="Email" value={u.email} />
          <Row label="Company" value={u.company_name || '—'} />
          <Row label="Name" value={[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'} />
          <Row label="User ID" value={u.id || '—'} mono />
          <Row label="Registered" value={fmtDate((u as any).created_at)} />
          <Row label="Last Active" value={fmtDate(u.last_active)} />
          <Row label="Most Used Tool" value={mostUsed} />
        </Card>
        <Card title="Account & Actions">
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <Pill tone={u.tier === 'free' ? 'gray' : 'red'}>{u.tier}</Pill>
            <Pill tone={u.subscription_status === 'active' ? 'green' : 'gray'}>{u.subscription_status || 'free'}</Pill>
            <Pill tone={u.is_suspended ? 'red' : 'green'}>{u.is_suspended ? 'Suspended' : 'Active'}</Pill>
            {u.role !== 'user' && <Pill tone="blue">{u.role.replace('_', ' ')}</Pill>}
          </div>
          <div className="flex flex-wrap gap-3">
            <PrimaryButton onClick={changePlan} className="!px-6 !py-3 !text-xs">{u.tier === 'free' ? 'Upgrade to Pro' : 'Downgrade'}</PrimaryButton>
            <button onClick={resetTokens} className="px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest border border-gray-200 text-gray-500 hover:text-[#0B0B0B]">Reset Tokens</button>
            <button onClick={toggleStatus} className={`px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest ${u.is_suspended ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>{u.is_suspended ? 'Enable' : 'Disable'}</button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Token Adjustment">
          <div className="flex flex-wrap gap-3 mb-4">
            <select value={tokAction} onChange={e => setTokAction(e.target.value as AdminTokenAction)} className="bg-[#FBFBFB] border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#0B0B0B] outline-none">
              <option value="add">Add</option><option value="remove">Remove</option><option value="refund">Refund</option><option value="bonus">Bonus</option><option value="reset">Reset to default</option>
            </select>
            {tokAction !== 'reset' && <input value={tokAmount} onChange={e => setTokAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Amount" className="w-28 bg-[#FBFBFB] border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#0B0B0B] outline-none" />}
          </div>
          <input value={tokReason} onChange={e => setTokReason(e.target.value)} placeholder="Reason (audited)" className="w-full bg-[#FBFBFB] border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#0B0B0B] outline-none mb-4" />
          <PrimaryButton onClick={adjustTokens} className="!px-6 !py-3 !text-xs">Apply Adjustment</PrimaryButton>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-3">Requires the new admin function to be deployed.</p>
        </Card>
        <Card title="Subscription">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input value={trialDays} onChange={e => setTrialDays(e.target.value.replace(/[^0-9]/g, ''))} className="w-24 bg-[#FBFBFB] border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#0B0B0B] outline-none" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">day trial</span>
            <button onClick={grantTrial} className="px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest bg-[#0B0B0B] text-white hover:bg-black">Grant Trial</button>
          </div>
          <button onClick={grantPro} className="px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest border border-gray-200 text-gray-500 hover:text-[#0B0B0B]">Grant Pro Access</button>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-3">Requires the new admin function to be deployed.</p>
        </Card>
      </div>

      <Card title="Activity Timeline">
        {logs.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center font-medium">No activity recorded.</p> : (
          <div className="divide-y divide-gray-50">
            {logs.slice(0, 20).map(l => (
              <div key={l.id} className="flex items-center justify-between py-3 first:pt-0">
                <div className="min-w-0"><span className="text-xs font-bold text-[#0B0B0B]">{l.module || l.action || 'Action'}</span>{l.error_code && <span className="text-[9px] text-red-500 ml-2">{l.error_code}</span>}</div>
                <span className="text-[10px] text-gray-400 shrink-0">{fmtDateTime(l.created_at || l.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
    <span className={`text-sm font-bold text-[#0B0B0B] truncate max-w-[60%] ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
  </div>
);

export default UserDetail;
