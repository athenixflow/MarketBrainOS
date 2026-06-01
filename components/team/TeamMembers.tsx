// Team Workspace — Members panel (Phase 6.1)
import React, { useEffect, useState } from 'react';
import { Card, PrimaryButton, Input, ErrorMessage } from '../UI';
import { Workspace, WorkspaceMember, WorkspaceRole } from '../../types';
import { getWorkspaceMembers, callManageMembership } from '../../services/persistenceService';
import { can, Membership, ROLE_LABELS } from '../../services/permissionService';

const ASSIGNABLE_ROLES: WorkspaceRole[] = ['admin', 'manager', 'analyst', 'viewer'];

const TeamMembers: React.FC<{ workspace: Workspace; membership: Membership | null; selfUid: string }> = ({ workspace, membership, selfUid }) => {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [search, setSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('analyst');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const canManage = can('members:manage', membership);

  const load = () => getWorkspaceMembers(workspace.id).then(setMembers);
  useEffect(() => { load(); }, [workspace.id]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const invite = async () => {
    setError(''); setBusy(true);
    try {
      await callManageMembership('invite', { workspaceId: workspace.id, email: inviteEmail, role: inviteRole });
      setInviteEmail('');
      flash(`Invitation sent to ${inviteEmail}`);
    } catch (e: any) { setError(e.message || 'Invite failed'); }
    finally { setBusy(false); }
  };

  const changeRole = async (uid: string, role: string) => {
    setError('');
    try { await callManageMembership('updateRole', { workspaceId: workspace.id, targetUid: uid, role }); await load(); }
    catch (e: any) { setError(e.message || 'Role change failed'); }
  };

  const remove = async (uid: string) => {
    setError('');
    try { await callManageMembership('remove', { workspaceId: workspace.id, targetUid: uid }); await load(); }
    catch (e: any) { setError(e.message || 'Remove failed'); }
  };

  const filtered = members.filter(m => m.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8">
      {canManage && (
        <Card title="Invite a member">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
            <div className="flex-grow">
              <Input label="Email" placeholder="teammate@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#0B0B0B] mb-3 tracking-widest uppercase opacity-40">Role</label>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                className="bg-[#FBFBFB] border border-gray-100 p-4 rounded-2xl text-sm outline-none">
                {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <PrimaryButton onClick={invite} disabled={busy || !inviteEmail}>{busy ? 'Sending…' : 'Send Invite'}</PrimaryButton>
          </div>
          <p className="mt-3 text-[10px] text-gray-400 font-medium">The invitee accepts from their account to join. (Email delivery is a deploy-time seam.)</p>
          {msg && <p className="mt-3 text-[10px] font-bold text-green-600 uppercase tracking-widest">{msg}</p>}
        </Card>
      )}

      {error && <ErrorMessage message={error} />}

      <Card title={`Members (${members.length})`}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members…"
          className="w-full mb-5 bg-[#FBFBFB] border border-gray-100 p-4 rounded-2xl text-sm outline-none" />
        <div className="space-y-3">
          {filtered.map(m => (
            <div key={m.id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#0B0B0B] truncate">{m.email}{m.uid === selfUid ? ' (you)' : ''}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {ROLE_LABELS[m.role] || m.role}{m.joined_at ? ` · joined ${new Date(m.joined_at).toLocaleDateString()}` : ''}
                </p>
              </div>
              {canManage && m.role !== 'owner' && m.uid !== selfUid && (
                <div className="flex items-center gap-2">
                  <select value={m.role} onChange={(e) => changeRole(m.uid, e.target.value)}
                    className="bg-white border border-gray-200 p-2 rounded-lg text-xs outline-none">
                    {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <button onClick={() => remove(m.uid)} className="text-[10px] font-bold text-gray-400 hover:text-[#FF0000] uppercase tracking-widest transition-colors">Remove</button>
                </div>
              )}
              {m.role === 'owner' && <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#0B0B0B] text-white">Owner</span>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default TeamMembers;
