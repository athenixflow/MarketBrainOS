// User Management directory — searchable/paginated roster with inline admin actions (plan, tokens,
// role, suspension) routed through the shared confirm/step-up flow. Rows link to the user detail.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader, AdminTable, Pill, Column } from '../primitives';
import { UserProfile, UserTier } from '../../../types';
import { callAdminManageSubscription } from '../../../services/persistenceService';
import { fmtDate } from '../util';

const Users: React.FC = () => {
  const a = useAdmin();
  const navigate = useNavigate();
  const [tierFilter, setTierFilter] = useState<'all' | 'free' | 'pro' | 'team' | 'agency' | 'enterprise'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  const rows = a.users.filter(u =>
    (tierFilter === 'all' || u.tier === tierFilter) &&
    (statusFilter === 'all' || (statusFilter === 'suspended' ? u.is_suspended : !u.is_suspended)));

  const changePlan = (u: UserProfile, plan: UserTier) => a.confirm({
    scope: 'admin:user_management', keyword: 'CONFIRM', warningTitle: 'SET PLAN',
    warningMessage: `Set ${u.email}'s subscription to ${plan.toUpperCase()}.${plan !== 'free' ? ' Status → active, renewal in 30 days.' : ''}`,
    run: async () => { await callAdminManageSubscription('changePlan', u.id!, { plan }); },
  });
  const resetTokens = (u: UserProfile) => a.confirm({
    type: 'resetTokens', userId: u.id, warningTitle: 'RESET TOKEN BALANCE', warningMessage: `Reset ${u.email} to plan default.`, keyword: 'RESET',
  });
  const toggleStatus = (u: UserProfile) => a.confirm({
    type: 'toggleStatus', userId: u.id, payload: { targetStatus: u.is_suspended ? 'active' : 'disabled' },
    warningTitle: u.is_suspended ? 'RESTORE ACCOUNT ACCESS' : 'DISABLE ACCOUNT ACCESS',
    warningMessage: u.is_suspended ? `${u.email} will regain access.` : `${u.email} will be signed out and blocked.`,
    keyword: u.is_suspended ? 'RESTORE' : 'DISABLE',
  });
  const toggleRole = (u: UserProfile) => u.role === 'user'
    ? a.confirm({ type: 'promoteToAdmin', userId: u.id, warningTitle: 'GRANT ADMIN PRIVILEGES', warningMessage: `${u.email} will gain admin access.`, keyword: 'PROMOTE' })
    : a.confirm({ type: 'demoteAdmin', userId: u.id, warningTitle: 'REVOKE ADMIN PRIVILEGES', warningMessage: `${u.email} will lose admin access.`, keyword: 'DEMOTE' });

  const columns: Column<UserProfile>[] = [
    { key: 'identity', header: 'Identity', render: u => (
      <button onClick={() => navigate(`/admin/users/${u.id}`)} className="text-left">
        <p className="text-sm font-bold text-[#0B0B0B] hover:text-[#FF0000] transition-colors">{u.email}</p>
        <p className="text-[10px] text-gray-400 font-medium">{u.company_name || 'Last active ' + fmtDate(u.last_active)}</p>
      </button>
    ) },
    { key: 'plan', header: 'Plan', render: u => (
      <select value={u.tier} disabled={a.isEmergencyActive}
        onChange={e => { const plan = e.target.value as UserTier; if (plan !== u.tier) changePlan(u, plan); }}
        className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-200 outline-none hover:text-[#0B0B0B] disabled:opacity-30 cursor-pointer">
        <option value="free">Free</option><option value="pro">Pro</option><option value="team">Team</option><option value="agency">Agency</option><option value="enterprise">Enterprise</option>
      </select>
    ) },
    { key: 'role', header: 'Role', render: u => <span className={`text-[10px] font-bold uppercase tracking-widest ${u.role !== 'user' ? 'text-blue-600' : 'text-gray-400'}`}>{u.role === 'user' ? 'User' : u.role.replace('_', ' ')}</span> },
    { key: 'tokens', header: 'Tokens', render: u => <span className="text-sm font-bold text-[#0B0B0B]">{u.tokens}</span> },
    { key: 'status', header: 'Status', render: u => <Pill tone={u.is_suspended ? 'red' : 'green'}>{u.is_suspended ? 'Suspended' : 'Active'}</Pill> },
    { key: 'actions', header: 'Actions', align: 'right', render: u => (
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => resetTokens(u)} disabled={a.isEmergencyActive} title="Reset tokens" className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:text-blue-600 disabled:opacity-30">Reset</button>
        <button onClick={() => toggleRole(u)} disabled={a.isEmergencyActive} className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:text-[#0B0B0B] disabled:opacity-30">{u.role === 'user' ? 'Promote' : 'Demote'}</button>
        <button onClick={() => toggleStatus(u)} disabled={a.isEmergencyActive} className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg disabled:opacity-30 ${u.is_suspended ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>{u.is_suspended ? 'Enable' : 'Disable'}</button>
      </div>
    ) },
  ];

  const Select = (val: string, set: (v: any) => void, opts: string[]) => (
    <select value={val} onChange={e => set(e.target.value)} className="bg-[#121212] border border-gray-800 rounded-xl px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-300 outline-none">
      {opts.map(o => <option key={o} value={o}>{o === 'all' ? 'All' : o}</option>)}
    </select>
  );

  return (
    <div>
      <AdminSectionHeader title="Users" subtitle={`${a.users.length} accounts. Search, filter, and manage roles, tokens, plans, and access.`} />
      <AdminTable
        rows={rows}
        columns={columns}
        searchKeys={[u => u.email, u => u.id || '', u => u.company_name || '']}
        searchPlaceholder="Search by email, company, or ID…"
        empty="No users match these filters."
        rightControls={<div className="flex gap-3">{Select(tierFilter, setTierFilter, ['all', 'free', 'pro', 'team', 'agency', 'enterprise'])}{Select(statusFilter, setStatusFilter, ['all', 'active', 'suspended'])}</div>}
      />
    </div>
  );
};

export default Users;
