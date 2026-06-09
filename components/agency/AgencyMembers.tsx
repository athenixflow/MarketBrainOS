// Agency Hub — Members panel (Phase 6.2)
import React, { useState } from 'react';
import { Card, PrimaryButton, Input, ErrorMessage } from '../UI';
import { Agency, WorkspaceMember, AgencyRole } from '../../types';
import { callManageAgencyMember } from '../../services/persistenceService';
import { can, Membership, ROLE_LABELS } from '../../services/permissionService';

const ASSIGNABLE: AgencyRole[] = ['agency_director', 'account_manager', 'strategist', 'analyst', 'viewer'];

const AgencyMembers: React.FC<{
  agency: Agency; members: WorkspaceMember[]; membership: Membership | null; selfUid: string; onReload: () => void;
}> = ({ agency, members, membership, selfUid, onReload }) => {
  const canManage = can('members:manage', membership);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AgencyRole>('analyst');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const invite = async () => {
    setError(''); setBusy(true);
    try { await callManageAgencyMember('invite', { agencyId: agency.id, email, role }); setEmail(''); flash(`Invitation sent to ${email}`); }
    catch (e: any) { setError(e.message || 'Invite failed'); } finally { setBusy(false); }
  };
  const changeRole = async (uid: string, r: string) => {
    setError('');
    try { await callManageAgencyMember('updateRole', { agencyId: agency.id, targetUid: uid, role: r }); onReload(); } catch (e: any) { setError(e.message || 'Role change failed'); }
  };
  const remove = async (uid: string) => {
    setError('');
    try { await callManageAgencyMember('remove', { agencyId: agency.id, targetUid: uid }); onReload(); } catch (e: any) { setError(e.message || 'Remove failed'); }
  };

  return (
    <div className="space-y-8">
      {canManage && (
        <Card title="Invite a team member">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
            <div className="flex-grow"><Input label="Email" placeholder="colleague@agency.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-3 tracking-widest uppercase">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as AgencyRole)} className="bg-[#FBFBFB] border border-gray-100 p-4 rounded-2xl text-sm outline-none">
                {ASSIGNABLE.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
              </select>
            </div>
            <PrimaryButton onClick={invite} disabled={busy || !email}>{busy ? 'Sending…' : 'Send Invite'}</PrimaryButton>
          </div>
          {msg && <p className="mt-3 text-[10px] font-bold text-green-600 uppercase tracking-widest">{msg}</p>}
        </Card>
      )}
      {error && <ErrorMessage message={error} />}
      <Card title={`Team (${members.length})`}>
        <div className="space-y-3">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 flex-wrap">
              <div className="min-w-0"><p className="text-sm font-bold text-[#0B0B0B] truncate">{m.email}{m.uid === selfUid ? ' (you)' : ''}</p><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{ROLE_LABELS[m.role] || m.role}</p></div>
              {canManage && m.role !== 'agency_owner' && m.uid !== selfUid && (
                <div className="flex items-center gap-2">
                  <select value={m.role} onChange={(e) => changeRole(m.uid, e.target.value)} className="bg-white border border-gray-200 p-2 rounded-lg text-xs outline-none">
                    {ASSIGNABLE.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                  </select>
                  <button onClick={() => remove(m.uid)} className="text-[10px] font-bold text-gray-400 hover:text-[#FF0000] uppercase tracking-widest">Remove</button>
                </div>
              )}
              {m.role === 'agency_owner' && <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#0B0B0B] text-white">Owner</span>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AgencyMembers;
