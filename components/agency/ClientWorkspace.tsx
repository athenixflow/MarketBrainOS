// Agency Hub — Client Workspace (Phase 6.2). A single client's ISOLATED intelligence.
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, PrimaryButton, Input, EmptyState, ErrorMessage } from '../UI';
import {
  Agency, AgencyClient, WorkspaceMember, ClientAssignment, ClientNote, ClientActivity, ClientAssignmentRole, TOKEN_COSTS,
} from '../../types';
import { Membership, can } from '../../services/permissionService';
import {
  getClientAssignments, getClientNotes, createClientNote, updateClientNote, deleteClientNote,
  getClientActivity, getAnalysesForScope, callManageClient, ToolAnalysisRecord,
} from '../../services/persistenceService';
import { useScope } from '../../context/ScopeContext';
import { getToolMeta } from '../../config/toolConfigs';
import { TOOL_CONFIG_LIST } from '../../config/toolConfigs';

const SUBTABS = ['Overview', 'Analyses', 'Notes', 'Activity', 'Team', 'Settings'] as const;
type SubTab = typeof SUBTABS[number];
const ASSIGN_ROLES: ClientAssignmentRole[] = ['account_manager', 'strategist', 'analyst', 'support'];
const TAG_OPTIONS = ['Active', 'High Priority', 'VIP', 'At Risk', 'Paused', 'Enterprise'];

const ClientWorkspace: React.FC<{
  agency: Agency; client: AgencyClient; agencyMembers: WorkspaceMember[];
  membership: Membership | null; selfUid: string; selfName: string; onBack: () => void; onChanged: () => void;
}> = ({ agency, client, agencyMembers, membership, selfUid, selfName, onBack, onChanged }) => {
  const { setScope } = useScope();
  const navigate = useNavigate();
  const [tab, setTab] = useState<SubTab>('Overview');

  const [analyses, setAnalyses] = useState<ToolAnalysisRecord[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [activity, setActivity] = useState<ClientActivity[]>([]);
  const [assignments, setAssignments] = useState<ClientAssignment[]>([]);
  const [error, setError] = useState('');

  const canManageClients = can('clients:manage', membership) || membership?.family === 'agency';
  const isPrivileged = membership?.family === 'agency' && (membership.role === 'agency_owner' || membership.role === 'agency_director');

  // Acting inside a client => client scope (so new analyses are stamped to this client).
  useEffect(() => { setScope({ level: 'client', clientId: client.id, agencyId: agency.id }); }, [client.id, agency.id, setScope]);

  const reload = useCallback(() => {
    getAnalysesForScope('', { level: 'client', clientId: client.id, agencyId: agency.id }).then(setAnalyses);
    getClientNotes(client.id, agency.id).then(setNotes);
    getClientActivity(client.id, agency.id).then(setActivity);
    getClientAssignments(client.id, agency.id).then(setAssignments);
  }, [client.id, agency.id]);
  useEffect(() => { reload(); }, [reload]);

  // Notes
  const [noteDraft, setNoteDraft] = useState('');
  const addNote = async () => {
    if (!noteDraft.trim()) return;
    await createClientNote({ client_id: client.id, agency_id: agency.id, author_uid: selfUid, author_name: selfName, content: noteDraft.trim() });
    setNoteDraft(''); getClientNotes(client.id, agency.id).then(setNotes);
  };
  const togglePin = async (n: ClientNote) => { await updateClientNote(n.id, { pinned: !n.pinned }); getClientNotes(client.id, agency.id).then(setNotes); };
  const delNote = async (id: string) => { await deleteClientNote(id); getClientNotes(client.id, agency.id).then(setNotes); };

  // Assignments
  const assign = async (uid: string, role: ClientAssignmentRole) => {
    setError('');
    try { await callManageClient('assign', { agencyId: agency.id, clientId: client.id, targetUid: uid, assignment_role: role }); getClientAssignments(client.id, agency.id).then(setAssignments); }
    catch (e: any) { setError(e.message || 'Assign failed'); }
  };
  const unassign = async (uid: string) => {
    setError('');
    try { await callManageClient('unassign', { agencyId: agency.id, clientId: client.id, targetUid: uid }); getClientAssignments(client.id, agency.id).then(setAssignments); }
    catch (e: any) { setError(e.message || 'Unassign failed'); }
  };

  // Settings
  const [edit, setEdit] = useState({ name: client.name, industry: client.industry || '', status: client.status, description: client.description || '' });
  const [tags, setTags] = useState<string[]>(client.tags || []);
  const saveSettings = async () => {
    setError('');
    try { await callManageClient('update', { agencyId: agency.id, clientId: client.id, ...edit }); onChanged(); }
    catch (e: any) { setError(e.message || 'Save failed'); }
  };
  const saveTags = async (next: string[]) => {
    setTags(next);
    try { await callManageClient('tag', { agencyId: agency.id, clientId: client.id, tags: next }); onChanged(); } catch (e: any) { setError(e.message || 'Tag failed'); }
  };
  const archive = async () => {
    setError('');
    try { await callManageClient('archive', { agencyId: agency.id, clientId: client.id }); onBack(); onChanged(); }
    catch (e: any) { setError(e.message || 'Archive failed'); }
  };

  const assignedUids = new Set(assignments.map(a => a.uid));
  const unassigned = agencyMembers.filter(m => !assignedUids.has(m.uid));

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors">← All clients</button>
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-2xl font-black text-[#0B0B0B] tracking-tight">{client.name}</h2>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{client.industry || '—'}</span>
        {(tags || []).map(t => <span key={t} className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t}</span>)}
      </div>

      <div className="flex gap-6 border-b border-gray-900/50 overflow-x-auto no-scrollbar">
        {SUBTABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`pb-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-all relative ${tab === t ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            {t}{tab === t && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF0000] rounded-full" />}
          </button>
        ))}
      </div>

      {error && <ErrorMessage message={error} />}

      {tab === 'Overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Card><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Analyses</p><p className="text-3xl font-black text-[#0B0B0B]">{analyses.length}</p></Card>
            <Card><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Notes</p><p className="text-3xl font-black text-[#0B0B0B]">{notes.length}</p></Card>
            <Card><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Assigned</p><p className="text-3xl font-black text-[#0B0B0B]">{assignments.length}</p></Card>
            <Card><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Status</p><p className="text-xl font-black text-[#0B0B0B] capitalize">{client.status.replace('_', ' ')}</p></Card>
          </div>
          <Card title={`Run an analysis for ${client.name}`}>
            <p className="text-sm text-gray-500 font-medium mb-6">
              Pick a tool — the result stays isolated to this client and is billed to the client's budget.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TOOL_CONFIG_LIST.map((t) => (
                <button
                  key={t.slug}
                  onClick={() => navigate(`/${t.slug}`)}
                  className="text-left p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-[#FF0000] transition-colors"
                >
                  <p className="text-sm font-bold text-[#0B0B0B]">{t.navLabel}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{TOKEN_COSTS[t.costKey]} tokens</p>
                </button>
              ))}
            </div>
          </Card>
          <Card title="Client information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <p><span className="text-gray-400">Website:</span> {client.website || '—'}</p>
              <p><span className="text-gray-400">Contact:</span> {client.primary_contact || '—'}</p>
              <p><span className="text-gray-400">Email:</span> {client.email || '—'}</p>
              <p><span className="text-gray-400">Phone:</span> {client.phone || '—'}</p>
            </div>
            {client.description && <p className="text-sm text-gray-600 mt-4">{client.description}</p>}
          </Card>
        </div>
      )}

      {tab === 'Analyses' && (
        analyses.length === 0 ? <EmptyState message="No analyses for this client yet." submessage="Run a tool while in this client's workspace; results stay isolated to this client." /> : (
          <div className="space-y-3">
            {analyses.map(a => (
              <Card key={a.id}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0B0B0B]">{getToolMeta(a.module)?.label || a.module}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{a.timestamp ? new Date(a.timestamp).toLocaleString() : ''}</p>
                  </div>
                  {typeof a.result?.score === 'number' && <span className="text-sm font-black text-[#0B0B0B]">{a.result.score}/100</span>}
                </div>
                {a.result?.summary && <p className="text-sm text-gray-500 font-medium mt-2 line-clamp-2">{a.result.summary}</p>}
              </Card>
            ))}
          </div>
        )
      )}

      {tab === 'Notes' && (
        <div className="space-y-6">
          <Card title="Strategic notes">
            <div className="flex gap-2 mb-4">
              <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Add a note…" className="flex-grow border border-gray-200 rounded-lg p-3 text-sm outline-none" />
              <button onClick={addNote} className="px-4 text-[10px] font-bold text-white bg-[#0B0B0B] rounded-lg uppercase tracking-widest">Add</button>
            </div>
            <div className="space-y-3">
              {notes.length === 0 && <p className="text-sm text-gray-400 font-medium">No notes yet.</p>}
              {notes.map(n => (
                <div key={n.id} className={`p-3 rounded-xl border ${n.pinned ? 'border-[#FF0000]/30 bg-red-50/30' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{n.author_name || 'Member'} · {n.created_at ? new Date(n.created_at).toLocaleString() : ''}</p>
                    <div className="flex gap-2">
                      <button onClick={() => togglePin(n)} className="text-[9px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest">{n.pinned ? 'Unpin' : 'Pin'}</button>
                      {n.author_uid === selfUid && <button onClick={() => delNote(n.id)} className="text-[9px] font-bold text-gray-400 hover:text-[#FF0000] uppercase tracking-widest">Delete</button>}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{n.content}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'Activity' && (
        <Card title="Client activity">
          {activity.length === 0 ? <p className="text-sm text-gray-400 font-medium py-4">No activity yet.</p> : (
            <div className="space-y-3">
              {activity.map(ev => (
                <div key={ev.id} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full mt-2 bg-[#FF0000] shrink-0" />
                  <div><p className="text-sm font-medium text-gray-700">{ev.summary}</p><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{ev.actor_name || 'Someone'} · {ev.created_at ? new Date(ev.created_at).toLocaleString() : ''}</p></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'Team' && (
        <div className="space-y-6">
          <Card title="Assigned team">
            {assignments.length === 0 ? <p className="text-sm text-gray-400 font-medium">No one assigned yet.</p> : (
              <div className="space-y-3">
                {assignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div><p className="text-sm font-bold text-[#0B0B0B]">{a.email}</p><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{a.assignment_role.replace('_', ' ')}</p></div>
                    {isPrivileged && <button onClick={() => unassign(a.uid)} className="text-[10px] font-bold text-gray-400 hover:text-[#FF0000] uppercase tracking-widest">Unassign</button>}
                  </div>
                ))}
              </div>
            )}
          </Card>
          {isPrivileged && (
            <Card title="Assign a member">
              {unassigned.length === 0 ? <p className="text-sm text-gray-400 font-medium">All agency members are assigned.</p> : (
                <div className="space-y-2">
                  {unassigned.map(m => (
                    <div key={m.uid} className="flex items-center justify-between gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 flex-wrap">
                      <span className="text-sm font-medium text-gray-700 truncate">{m.email}</span>
                      <div className="flex gap-2">
                        <select id={`role-${m.uid}`} className="border border-gray-200 rounded-lg p-2 text-xs outline-none" defaultValue="analyst">
                          {ASSIGN_ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                        </select>
                        <button onClick={() => assign(m.uid, (document.getElementById(`role-${m.uid}`) as HTMLSelectElement).value as ClientAssignmentRole)} className="px-3 text-[10px] font-bold text-white bg-[#0B0B0B] rounded-lg uppercase tracking-widest">Assign</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {tab === 'Settings' && (
        canManageClients ? (
          <div className="space-y-6 max-w-2xl">
            <Card title="Client details">
              <div className="space-y-4">
                <Input label="Name" placeholder="Client name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                <Input label="Industry" placeholder="Industry" value={edit.industry} onChange={(e) => setEdit({ ...edit, industry: e.target.value })} />
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-3 tracking-widest uppercase">Status</label>
                  <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as any })} className="w-full bg-[#FBFBFB] border border-gray-100 p-4 rounded-2xl text-sm outline-none">
                    <option value="active">Active</option><option value="growing">Growing</option><option value="at_risk">At Risk</option><option value="inactive">Inactive</option>
                  </select>
                </div>
                <Input label="Description" placeholder="About this client" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} multiline />
                <PrimaryButton onClick={saveSettings}>Save changes</PrimaryButton>
              </div>
            </Card>
            <Card title="Tags">
              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map(t => {
                  const on = tags.includes(t);
                  return <button key={t} onClick={() => saveTags(on ? tags.filter(x => x !== t) : [...tags, t])} className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${on ? 'bg-[#0B0B0B] text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>{t}</button>;
                })}
              </div>
            </Card>
            {isPrivileged && (
              <Card title="Danger zone">
                <p className="text-xs text-gray-500 mb-4">Archiving removes the client from the directory. Analyses and history are preserved.</p>
                <button onClick={archive} className="px-5 py-3 rounded-xl border border-red-200 text-[#FF0000] text-[11px] font-bold uppercase tracking-widest hover:bg-red-50 transition-colors">Archive client</button>
              </Card>
            )}
          </div>
        ) : <p className="text-gray-400 text-sm font-medium py-8">You don't have permission to manage this client.</p>
      )}
    </div>
  );
};

export default ClientWorkspace;
