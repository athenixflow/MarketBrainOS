// Team Workspace — Members panel. Owner/admin provisions members directly (active immediately) with a
// role, a per-member tool allowlist, and a per-cycle token budget drawn from the team pool. The
// allowlist + budget gate the member's team-scope analyses in executeAnalysis.
// Markup is kept identical to agency/AgencyMembers and enterprise/EnterpriseMembers.
import React, { useMemo, useState } from 'react';
import { Card, PrimaryButton, SecondaryButton, Input, Select, Checkbox, Stat, Badge, ErrorMessage, SuccessMessage } from '../UI';
import { Workspace, WorkspaceMember, WorkspaceRole } from '../../types';
import { callCreateWorkspaceMember, callUpdateWorkspaceMember, callManageMembership } from '../../services/persistenceService';
import { can, Membership, ROLE_LABELS } from '../../services/permissionService';
import { TOOL_CONFIG_LIST } from '../../config/toolConfigs';
import { DEFAULT_PRICING_CONFIG } from '../../config/pricingConfig';

const ASSIGNABLE: WorkspaceRole[] = ['admin', 'manager', 'analyst', 'viewer'];
const DEFAULT_BUDGET = 50;
const OWNER_ROLE = 'owner';
const POOL_LABEL = 'Team pool';
const BUDGET_HINT = 'From the team pool. 0 = unlimited within the pool.';
const EMAIL_PLACEHOLDER = 'colleague@company.com';

const roleTone = (role: string): 'red' | 'blue' | 'neutral' => {
  if (role === 'owner' || role === 'agency_owner' || role === 'enterprise_owner') return 'red';
  if (role === 'admin' || role === 'agency_director' || role === 'executive_admin') return 'blue';
  return 'neutral';
};
const rowAction = 'text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors';

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <Stat label={POOL_LABEL} value={pool.toLocaleString()} />
            <Stat label="Allocated" value={allocated.toLocaleString()} />
            <Stat label="Unallocated" value={remaining.toLocaleString()} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <Input compact label="Email" placeholder={EMAIL_PLACEHOLDER} value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!editingUid} />
            <Select compact label="Role" value={role} onChange={(v) => setRole(v as WorkspaceRole)} options={ASSIGNABLE.map(r => ({ value: r, label: ROLE_LABELS[r] || r }))} className="md:w-52" />
            <Input compact label="Monthly token budget" type="number" placeholder="0" value={String(budget)} onChange={(e) => setBudget(Math.max(0, parseInt(e.target.value, 10) || 0))} className="md:w-44" />
          </div>
          <p className="mt-2 text-xs text-gray-500">{BUDGET_HINT}</p>
          {!editingUid && (
            <div className="mt-6">
              <Input compact label="Temporary password" type="password" autoComplete="new-password" placeholder="They can change it after first login" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}

          <div className="mt-8">
            <p className="text-[11px] font-bold text-gray-500 tracking-widest uppercase mb-2">Tools this member can use</p>
            <p className="text-xs text-gray-500 mb-3">Leave all unchecked to allow every tool.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {TOOL_CONFIG_LIST.map((t) => (
                <div key={t.slug} className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <Checkbox label={t.navLabel} checked={tools.has(t.module)} onChange={() => toggleTool(t.module)} className="w-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-8">
            <PrimaryButton size="sm" onClick={submit} disabled={busy || (!editingUid && !email)}>{busy ? 'Saving…' : (editingUid ? 'Save changes' : 'Add member')}</PrimaryButton>
            {editingUid && <SecondaryButton size="sm" onClick={reset}>Cancel</SecondaryButton>}
          </div>
          {msg && <SuccessMessage message={msg} className="mt-4" />}
        </Card>
      )}

      {error && <ErrorMessage message={error} />}

      <Card title={`Team (${members.length})`}>
        <div className="space-y-3">
          {members.map(m => {
            const isOwner = m.role === OWNER_ROLE;
            const used = m.consumed_this_cycle || 0;
            const cap = m.token_budget || 0;
            const toolCount = (m.allowed_tools || []).length;
            return (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-[#0B0B0B] truncate">{m.email}{m.uid === selfUid ? ' (you)' : ''}</p>
                    <Badge tone={roleTone(m.role)}>{ROLE_LABELS[m.role] || m.role}</Badge>
                  </div>
                  {!isOwner && (
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums mt-1">
                      {toolCount === 0 ? 'All tools' : `${toolCount} tools`} · Budget {cap > 0 ? `${used}/${cap}` : 'unlimited'}
                    </p>
                  )}
                </div>
                {canManage && !isOwner && m.uid !== selfUid && (
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => startEdit(m)} className={rowAction}>Edit</button>
                    <button onClick={() => remove(m.uid)} className={`${rowAction} hover:text-[#FF0000]`}>Remove</button>
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
