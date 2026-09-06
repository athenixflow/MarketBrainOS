// Agency Hub — Client Workspace (Phase 6.2). A single client's ISOLATED intelligence.
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Stat, PrimaryButton, SecondaryButton, Input, Select, Tabs, Badge, EmptyState, ErrorMessage, PermissionDenied,
} from '../UI';
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
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'growing', label: 'Growing' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'inactive', label: 'Inactive' },
];

const roleLabel = (r: string) => r.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
const rowAction = 'text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors';
// Tag chips live inside a white Card, so the "on" state is the dark chip.
const tagChip = (on: boolean) =>
  `px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors ${
    on ? 'bg-[#0B0B0B] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
  }`;

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

  // Assignments. The role picker is controlled state per member (it used to be read back out of the
  // DOM by id), defaulting to 'analyst' exactly as before.
  const [assignRoles, setAssignRoles] = useState<Record<string, ClientAssignmentRole>>({});
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
  const [confirmArchive, setConfirmArchive] = useState(false);
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

  const info: Array<[string, string | undefined]> = [
    ['Website', client.website],
    ['Contact', client.primary_contact],
    ['Email', client.email],
    ['Phone', client.phone],
  ];

  return (
    <div>
      <div className="mb-6">
        <button onClick={onBack} className="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest transition-colors">← All clients</button>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{client.name}</h2>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{client.industry || 'No industry'}</span>
        {(tags || []).map(t => <Badge key={t} tone="dark">{t}</Badge>)}
      </div>

      <Tabs tabs={[...SUBTABS]} activeTab={tab} onTabChange={(t) => setTab(t as SubTab)} tone="dark" />

      <div className="space-y-8">
        {error && <ErrorMessage message={error} />}

        {tab === 'Overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card><Stat label="Analyses" value={analyses.length} /></Card>
              <Card><Stat label="Notes" value={notes.length} /></Card>
              <Card><Stat label="Assigned" value={assignments.length} /></Card>
              <Card><Stat label="Status" value={<span className="capitalize">{client.status.replace('_', ' ')}</span>} /></Card>
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
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1 tabular-nums">{TOKEN_COSTS[t.costKey]} tokens</p>
                  </button>
                ))}
              </div>
            </Card>
            <Card title="Client information">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {info.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{k}</dt>
                    <dd className="text-sm font-medium text-[#0B0B0B] break-words">{v || 'Not set'}</dd>
                  </div>
                ))}
              </dl>
              {client.description && <p className="text-sm text-gray-600 mt-6 leading-relaxed">{client.description}</p>}
            </Card>
          </div>
        )}

        {tab === 'Analyses' && (
          analyses.length === 0 ? <EmptyState card message="No analyses for this client yet" submessage="Run a tool while in this client's workspace; results stay isolated to this client." /> : (
            <div className="space-y-4">
              {analyses.map(a => (
                <Card key={a.id}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0B0B0B]">{getToolMeta(a.module)?.label || a.module}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">{a.timestamp ? new Date(a.timestamp).toLocaleString() : ''}</p>
                    </div>
                    {typeof a.result?.score === 'number' && <span className="text-sm font-black text-[#0B0B0B] tabular-nums">{a.result.score}/100</span>}
                  </div>
                  {a.result?.summary && <p className="text-sm text-gray-500 font-medium mt-3 line-clamp-2">{a.result.summary}</p>}
                </Card>
              ))}
            </div>
          )
        )}

        {tab === 'Notes' && (
          <Card title="Strategic notes">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Input compact ariaLabel="Add a note" placeholder="Add a note…" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} className="flex-grow min-w-[12rem]" />
              <PrimaryButton size="sm" onClick={addNote}>Add</PrimaryButton>
            </div>
            {notes.length === 0 ? <EmptyState message="No notes yet" submessage="Keep strategic context about this client here for the whole team." /> : (
              <div className="space-y-3">
                {notes.map(n => (
                  <div key={n.id} className={`p-4 rounded-2xl border ${n.pinned ? 'border-[#FF0000]/30 bg-red-50/30' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">{n.author_name || 'Member'} · {n.created_at ? new Date(n.created_at).toLocaleString() : ''}</p>
                      <div className="flex items-center gap-3">
                        <button onClick={() => togglePin(n)} className={rowAction}>{n.pinned ? 'Unpin' : 'Pin'}</button>
                        {n.author_uid === selfUid && <button onClick={() => delNote(n.id)} className={`${rowAction} hover:text-[#FF0000]`}>Delete</button>}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mt-2">{n.content}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === 'Activity' && (
          <Card title="Client activity">
            {activity.length === 0 ? <EmptyState message="No activity yet" submessage="Client events appear here as your team works." /> : (
              <div className="space-y-3">
                {activity.map(ev => (
                  <div key={ev.id} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full mt-2 bg-[#FF0000] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700">{ev.summary}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">{ev.actor_name || 'Someone'} · {ev.created_at ? new Date(ev.created_at).toLocaleString() : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === 'Team' && (
          <div className="space-y-6">
            <Card title="Assigned team">
              {assignments.length === 0 ? <EmptyState message="No one assigned yet" submessage="Assign agency members so they can work inside this client." /> : (
                <div className="space-y-3">
                  {assignments.map(a => (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="min-w-0 flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-[#0B0B0B] truncate">{a.email}</p>
                        <Badge tone="neutral">{roleLabel(a.assignment_role)}</Badge>
                      </div>
                      {isPrivileged && <button onClick={() => unassign(a.uid)} className={`${rowAction} hover:text-[#FF0000]`}>Unassign</button>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
            {isPrivileged && (
              <Card title="Assign a member">
                {unassigned.length === 0 ? <EmptyState message="All agency members are assigned" /> : (
                  <div className="space-y-2">
                    {unassigned.map(m => (
                      <div key={m.uid} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <span className="text-sm font-medium text-gray-700 truncate min-w-0">{m.email}</span>
                        <div className="flex items-center gap-3">
                          <Select
                            compact
                            ariaLabel={`Assignment role for ${m.email}`}
                            value={assignRoles[m.uid] || 'analyst'}
                            onChange={(v) => setAssignRoles((p) => ({ ...p, [m.uid]: v as ClientAssignmentRole }))}
                            options={ASSIGN_ROLES.map(r => ({ value: r, label: roleLabel(r) }))}
                            className="w-44"
                          />
                          <PrimaryButton size="sm" onClick={() => assign(m.uid, assignRoles[m.uid] || 'analyst')}>Assign</PrimaryButton>
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
                <Input label="Name" placeholder="Client name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                <Input label="Industry" placeholder="Industry" value={edit.industry} onChange={(e) => setEdit({ ...edit, industry: e.target.value })} />
                <Select label="Status" value={edit.status} onChange={(v) => setEdit({ ...edit, status: v as any })} options={STATUS_OPTIONS} />
                <Input label="Description" placeholder="About this client" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} multiline />
                <PrimaryButton onClick={saveSettings}>Save changes</PrimaryButton>
              </Card>
              <Card title="Tags">
                <div className="flex flex-wrap gap-2">
                  {TAG_OPTIONS.map(t => {
                    const on = tags.includes(t);
                    return <button key={t} aria-pressed={on} onClick={() => saveTags(on ? tags.filter(x => x !== t) : [...tags, t])} className={tagChip(on)}>{t}</button>;
                  })}
                </div>
              </Card>
              {isPrivileged && (
                <Card title="Danger zone">
                  <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-2">Archive client</p>
                  <p className="text-xs text-gray-500 mb-4 leading-relaxed">Archiving removes the client from the directory. Analyses and history are preserved.</p>
                  {confirmArchive ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <PrimaryButton size="sm" onClick={archive}>Yes, archive client</PrimaryButton>
                      <SecondaryButton size="sm" onClick={() => setConfirmArchive(false)}>Cancel</SecondaryButton>
                    </div>
                  ) : (
                    <SecondaryButton size="sm" onClick={() => setConfirmArchive(true)}>Archive client</SecondaryButton>
                  )}
                </Card>
              )}
            </div>
          ) : <PermissionDenied message="You do not have permission to manage this client" />
        )}
      </div>
    </div>
  );
};

export default ClientWorkspace;
