// Team Workspace — Members panel. Owner/admin provisions members directly (active immediately) with a
// role, a per-member tool allowlist, and a per-cycle token budget drawn from the team pool. The
// allowlist + budget gate the member's team-scope analyses in executeAnalysis.
import React, { useMemo, useState } from 'react';
import { Card, PrimaryButton, Input, ErrorMessage } from '../UI';
import { Workspace, WorkspaceMember, WorkspaceRole } from '../../types';
import { callCreateWorkspaceMember, callUpdateWorkspaceMember, callManageMembership } from '../../services/persistenceService';
import { can, Membership, ROLE_LABELS } from '../../services/permissionService';
import { TOOL_CONFIG_LIST } from '../../config/toolConfigs';
import { DEFAULT_PRICING_CONFIG } from '../../config/pricingConfig';

const ASSIGNABLE: WorkspaceRole[] = ['admin', 'manager', 'analyst', 'viewer'];
const DEFAULT_BUDGET = 50;

const TeamMembers: React.FC<{
  workspace: Workspace; members: WorkspaceMember[]; membership: Membership | null; selfUid: string; onReload: () => void;
}> = ({ workspace, members, membership, selfUid, onReload }) => {
  const canManage = can('members:manage', membership);
  const pool = DEFAULT_PRICING_CONFIG.plans.team.monthlyTokens;
  const allocated = useMemo(() => members.reduce((s, m) => s + (m.token_budget || 0), 0), [members]);
  const remaining = Math.max(0, pool - allocated);

  const [editingUid, setEditingUid] = useState<string | null>(null); // null = add mode
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('analyst');
  const [tools, setTools] = useState<Set<string>>(new Set());
  const [budget, setBudget] = useState<number>(DEFAULT_BUDGET);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const reset = () => { setEditingUid(null); setEmail(''); setPassword(''); setRole('analyst'); setTools(new Set()); setBudget(DEFAULT_BUDGET); };
  const toggleTool = (moduleKey: string) => setTools((prev) => { const n = new Set(prev); n.has(moduleKey) ? n.delete(moduleKey) : n.add(moduleKey); return n; });
  const startEdit = (m: WorkspaceMember) => {
    setEditingUid(m.uid); setEmail(m.email); setPassword(''); setRole((m.role as WorkspaceRole) || 'analyst');
    setTools(new Set(m.allowed_tools || [])); setBudget(m.token_budget || 0);
  };

  const submit = async () => {
    setError(''); setBusy(true);
    try {
      const allowed_tools = Array.from(tools);
      if (editingUid) {
        await callUpdateWorkspaceMember({ workspaceId: workspace.id, targetUid: editingUid, role, allowed_tools, token_budget: budget });
        flash('Member updated.');
      } else {
        await callCreateWorkspaceMember({ workspaceId: workspace.id, email, password, role, allowed_tools, token_budget: budget });
        flash(`${email} added.`);
      }
      reset(); onReload();
    } catch (e: any) { setError(e.message || 'Failed.'); } finally { setBusy(false); }
  };
  const remove = async (uid: string) => {
    setError('');
    try { await callManageMembership('remove', { workspaceId: workspace.id, targetUid: uid }); onReload(); }
    catch (e: any) { setError(e.message || 'Remove failed'); }
  };

  return (
    <div className="space-y-8">
      {canManage && (
        <Card title={editingUid ? 'Edit member' : 'Add a team member'}>
          <div className="flex flex-wrap gap-8 mb-6">
            <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Team pool</p><p className="text-lg font-black text-[#0B0B0B] mt-1">{pool.toLocaleString()}</p></div>
            <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Allocated</p><p className="text-lg font-black text-[#0B0B0B] mt-1">{allocated.toLocaleString()}</p></div>
            <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Unallocated</p><p className="text-lg font-black text-[#0B0B0B] mt-1">{remaining.toLocaleString()}</p></div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Input label="Email" placeholder="colleague@company.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!editingUid} />
            {!editingUid && <Input label="Temporary password" placeholder="They can change it after first login" value={password} onChange={(e) => setPassword(e.target.value)} />}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-3 tracking-widest uppercase">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as WorkspaceRole)} className="w-full bg-[#FBFBFB] border border-gray-100 p-4 rounded-2xl text-sm outline-none">
                {ASSIGNABLE.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-3 tracking-widest uppercase">Monthly token budget</label>
              <input type="number" min={0} value={budget} onChange={(e) => setBudget(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-full bg-[#FBFBFB] border border-gray-100 p-4 rounded-2xl text-sm outline-none text-gray-700" />
              <p className="text-[10px] font-medium text-gray-400 mt-2">From the team pool. 0 = unlimited within the pool.</p>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-xs font-bold text-gray-700 mb-3 tracking-widest uppercase">Tools this member can use</label>
            <p className="text-[11px] text-gray-400 font-medium mb-3">Leave all unchecked to allow every tool.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {TOOL_CONFIG_LIST.map((t) => (
                <label key={t.slug} className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer">
                  <input type="checkbox" checked={tools.has(t.module)} onChange={() => toggleTool(t.module)} className="accent-[#FF0000]" />
                  <span className="text-sm font-medium text-gray-700">{t.navLabel}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <PrimaryButton onClick={submit} disabled={busy || (!editingUid && !email)}>{busy ? 'Saving…' : (editingUid ? 'Save changes' : 'Add member')}</PrimaryButton>
            {editingUid && <button onClick={reset} className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest">Cancel</button>}
          </div>
          {msg && <p className="mt-3 text-[10px] font-bold text-green-600 uppercase tracking-widest">{msg}</p>}
        </Card>
      )}

      {error && <ErrorMessage message={error} />}

      <Card title={`Team (${members.length})`}>
        <div className="space-y-3">
          {members.map(m => {
            const isOwner = m.role === 'owner';
            const used = m.consumed_this_cycle || 0;
            const cap = m.token_budget || 0;
            const toolCount = (m.allowed_tools || []).length;
            return (
              <div key={m.id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#0B0B0B] truncate">{m.email}{m.uid === selfUid ? ' (you)' : ''}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                    {ROLE_LABELS[m.role] || m.role}
                    {!isOwner && ` • ${toolCount === 0 ? 'all tools' : `${toolCount} tools`} • budget ${cap > 0 ? `${used}/${cap}` : 'unlimited'}`}
                  </p>
                </div>
                {isOwner && <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#0B0B0B] text-white">Owner</span>}
                {canManage && !isOwner && m.uid !== selfUid && (
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => startEdit(m)} className="text-[10px] font-bold text-gray-500 hover:text-[#0B0B0B] uppercase tracking-widest">Edit</button>
                    <button onClick={() => remove(m.uid)} className="text-[10px] font-bold text-gray-400 hover:text-[#FF0000] uppercase tracking-widest">Remove</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default TeamMembers;
