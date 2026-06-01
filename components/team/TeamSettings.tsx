// Team Workspace — Settings (Phase 6.1)
import React, { useState } from 'react';
import { Card, PrimaryButton, Input, ErrorMessage } from '../UI';
import { Workspace, WorkspaceMember } from '../../types';
import { callManageWorkspace } from '../../services/persistenceService';
import { can, Membership } from '../../services/permissionService';

const TeamSettings: React.FC<{
  workspace: Workspace; membership: Membership | null; members: WorkspaceMember[];
  selfUid: string; onChanged: () => void;
}> = ({ workspace, membership, members, selfUid, onChanged }) => {
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || '');
  const [transferTo, setTransferTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const canSettings = can('settings:manage', membership);
  const isOwner = membership?.family === 'workspace' && membership.role === 'owner';
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const save = async () => {
    setError(''); setBusy(true);
    try { await callManageWorkspace('update', { workspaceId: workspace.id, name, description }); flash('Saved'); onChanged(); }
    catch (e: any) { setError(e.message || 'Save failed'); } finally { setBusy(false); }
  };

  const archive = async () => {
    setError(''); setBusy(true);
    try { await callManageWorkspace('delete', { workspaceId: workspace.id }); flash('Workspace archived'); onChanged(); }
    catch (e: any) { setError(e.message || 'Archive failed'); } finally { setBusy(false); }
  };

  const transfer = async () => {
    if (!transferTo) return;
    setError(''); setBusy(true);
    try { await callManageWorkspace('transfer', { workspaceId: workspace.id, targetUid: transferTo }); flash('Ownership transferred'); onChanged(); }
    catch (e: any) { setError(e.message || 'Transfer failed'); } finally { setBusy(false); }
  };

  if (!canSettings) return <p className="text-gray-400 text-sm font-medium py-8">You don't have permission to manage workspace settings.</p>;

  const others = members.filter(m => m.uid !== selfUid && m.status !== 'removed');

  return (
    <div className="space-y-8 max-w-2xl">
      {error && <ErrorMessage message={error} />}
      {msg && <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">{msg}</p>}

      <Card title="General">
        <div className="space-y-4">
          <Input label="Workspace name" placeholder="Workspace name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Description" placeholder="What this workspace is for" value={description} onChange={(e) => setDescription(e.target.value)} multiline />
          <PrimaryButton onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</PrimaryButton>
        </div>
      </Card>

      {isOwner && (
        <Card title="Ownership & lifecycle">
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-[#0B0B0B] mb-3 tracking-widest uppercase opacity-40">Transfer ownership</label>
              <div className="flex gap-2">
                <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className="flex-grow bg-[#FBFBFB] border border-gray-100 p-4 rounded-2xl text-sm outline-none">
                  <option value="">Select a member…</option>
                  {others.map(m => <option key={m.uid} value={m.uid}>{m.email}</option>)}
                </select>
                <button onClick={transfer} disabled={!transferTo || busy} className="px-5 rounded-xl bg-[#0B0B0B] text-white text-[11px] font-bold uppercase tracking-widest disabled:opacity-30">Transfer</button>
              </div>
            </div>
            <div className="pt-6 border-t border-gray-100">
              <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-2">Danger zone</p>
              <p className="text-xs text-gray-500 mb-4">Archiving disables the workspace. Analyses and history are preserved (Master Wiring: no data loss).</p>
              <button onClick={archive} disabled={busy} className="px-5 py-3 rounded-xl border border-red-200 text-[#FF0000] text-[11px] font-bold uppercase tracking-widest hover:bg-red-50 transition-colors">Archive workspace</button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default TeamSettings;
