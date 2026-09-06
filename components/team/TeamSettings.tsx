// Team Workspace — Settings (Phase 6.1)
import React, { useState } from 'react';
import { Card, PrimaryButton, SecondaryButton, Input, Select, ErrorMessage, SuccessMessage, PermissionDenied } from '../UI';
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
  const [confirmArchive, setConfirmArchive] = useState(false);
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
    catch (e: any) { setError(e.message || 'Archive failed'); } finally { setBusy(false); setConfirmArchive(false); }
  };

  const transfer = async () => {
    if (!transferTo) return;
    setError(''); setBusy(true);
    try { await callManageWorkspace('transfer', { workspaceId: workspace.id, targetUid: transferTo }); flash('Ownership transferred'); onChanged(); }
    catch (e: any) { setError(e.message || 'Transfer failed'); } finally { setBusy(false); }
  };

  if (!canSettings) return <PermissionDenied message="You do not have permission to manage workspace settings" />;

  const others = members.filter(m => m.uid !== selfUid && m.status !== 'removed');

  return (
    <div className="space-y-6 max-w-2xl">
      {error && <ErrorMessage message={error} />}
      {msg && <SuccessMessage message={msg} />}

      <Card title="General">
        <Input label="Workspace name" placeholder="Workspace name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Description" placeholder="What this workspace is for" value={description} onChange={(e) => setDescription(e.target.value)} multiline />
        <PrimaryButton onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</PrimaryButton>
      </Card>

      {isOwner && (
        <Card title="Danger zone">
          <div className="space-y-8">
            <div>
              <Select
                label="Transfer ownership"
                value={transferTo}
                onChange={setTransferTo}
                compact
                options={[
                  { value: '', label: 'Select a member…' },
                  ...others.map(m => ({ value: m.uid, label: m.email })),
                ]}
              />
              <div className="mt-4">
                <SecondaryButton size="sm" onClick={transfer} disabled={!transferTo || busy}>Transfer ownership</SecondaryButton>
              </div>
            </div>
            <div className="pt-8 border-t border-gray-100">
              <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-2">Archive workspace</p>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">Archiving disables the workspace. Analyses and history are preserved.</p>
              {confirmArchive ? (
                <div className="flex flex-wrap items-center gap-3">
                  <PrimaryButton size="sm" onClick={archive} disabled={busy}>Yes, archive workspace</PrimaryButton>
                  <SecondaryButton size="sm" onClick={() => setConfirmArchive(false)} disabled={busy}>Cancel</SecondaryButton>
                </div>
              ) : (
                <SecondaryButton size="sm" onClick={() => setConfirmArchive(true)} disabled={busy}>Archive workspace</SecondaryButton>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default TeamSettings;
