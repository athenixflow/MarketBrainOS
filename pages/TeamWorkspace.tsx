// Team Workspace — container page (Phase 6.1)
// Handles all states: no workspace (create/upgrade pitch), pending invitations (accept),
// and an active workspace (tabbed: Overview/Members/Library/Reports/Analytics/Activity/Settings).
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, PrimaryButton, Input, LoadingState, ErrorMessage } from '../components/UI';
import AnimatedSection from '../components/AnimatedSection';
import { useAuth } from '../context/AuthContext';
import { useScope } from '../context/ScopeContext';
import { Membership } from '../services/permissionService';
import {
  Workspace, WorkspaceMember, WorkspaceInvitation,
} from '../types';
import {
  getWorkspace, getWorkspaceMembers, getPendingInvitations,
  callManageWorkspace, callManageMembership, callPurchaseExpansion,
} from '../services/persistenceService';
import { TOOL_CONFIG_LIST } from '../config/toolConfigs';
import { DEFAULT_PRICING_CONFIG } from '../config/pricingConfig';
import CapacityPanel from '../components/CapacityPanel';
import TeamOverview from '../components/team/TeamOverview';
import TeamMembers from '../components/team/TeamMembers';
import SharedLibrary from '../components/team/SharedLibrary';
import TeamActivity from '../components/team/TeamActivity';
import TeamAnalytics from '../components/team/TeamAnalytics';
import TeamSettings from '../components/team/TeamSettings';
import TeamReports from '../components/team/TeamReports';

const TABS = ['Overview', 'Members', 'Library', 'Reports', 'Analytics', 'Activity', 'Settings'] as const;
type Tab = typeof TABS[number];

const TeamWorkspace: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { scope, memberships, setScope, refreshMemberships } = useScope();
  const navigate = useNavigate();

  const workspaceMemberships = useMemo(() => memberships.filter(m => m.family === 'workspace'), [memberships]);

  const [activeId, setActiveId] = useState<string>('');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvitation[]>([]);
  const [tab, setTab] = useState<Tab>('Overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Create form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Pick the active workspace: the team scope's id, else the first workspace membership.
  useEffect(() => {
    const id = scope.level === 'team' && scope.workspaceId ? scope.workspaceId : workspaceMemberships[0]?.containerId || '';
    setActiveId(id);
  }, [scope, workspaceMemberships]);

  const loadWorkspace = useCallback(async () => {
    if (!activeId) { setWorkspace(null); setMembers([]); return; }
    const [ws, mem] = await Promise.all([getWorkspace(activeId), getWorkspaceMembers(activeId)]);
    setWorkspace(ws); setMembers(mem);
    // Acting inside the workspace => team scope (so new analyses are shared by default).
    if (ws && (scope.level !== 'team' || scope.workspaceId !== ws.id)) {
      setScope({ level: 'team', workspaceId: ws.id });
    }
  }, [activeId, scope.level, scope.workspaceId, setScope]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (user?.email) setInvites(await getPendingInvitations(user.email));
      await loadWorkspace();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, loadWorkspace]);

  const selfMember = members.find(m => m.uid === user?.uid);
  const membership: Membership | null = selfMember ? { family: 'workspace', role: selfMember.role as any } : null;
  const selfName = profile?.email || user?.email || 'You';

  const createWorkspace = async () => {
    if (name.trim().length < 2) { setError('Enter a workspace name.'); return; }
    setError(''); setBusy(true);
    try {
      const res: any = await callManageWorkspace('create', { name: name.trim(), description: description.trim() });
      await refreshProfile();            // tier may have upgraded to 'team'
      await refreshMemberships();
      if (res?.workspaceId) { setScope({ level: 'team', workspaceId: res.workspaceId }); setActiveId(res.workspaceId); }
      setName(''); setDescription('');
    } catch (e: any) { setError(e.message || 'Could not create workspace.'); }
    finally { setBusy(false); }
  };

  const acceptInvite = async (inv: WorkspaceInvitation) => {
    setBusy(true); setError('');
    try {
      await callManageMembership('accept', { workspaceId: inv.workspace_id, invitationId: inv.id });
      await refreshMemberships();
      if (user?.email) setInvites(await getPendingInvitations(user.email));
      setScope({ level: 'team', workspaceId: inv.workspace_id }); setActiveId(inv.workspace_id);
    } catch (e: any) { setError(e.message || 'Could not accept invite.'); }
    finally { setBusy(false); }
  };

  const handleQuickAction = (target: string) => {
    if (target === '__tools') { navigate(`/${TOOL_CONFIG_LIST[0]?.slug || ''}`); return; }
    const map: Record<string, Tab> = { members: 'Members', reports: 'Reports', settings: 'Settings' };
    if (map[target]) setTab(map[target]);
  };

  if (loading) return <LoadingState message="Loading your workspace…" />;

  // --- No workspace: show pending invites and/or the create/upgrade pitch ---
  if (!workspace) {
    return (
      <div className="space-y-10">
        <PageHeader title="Team Workspace" subtitle="Collaborate with your team — shared analyses, reports, and intelligence." />
        {error && <ErrorMessage message={error} />}

        {invites.length > 0 && (
          <AnimatedSection index={0}>
            <Card title="Pending invitations">
              <div className="space-y-3">
                {invites.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 flex-wrap">
                    <div><p className="text-sm font-bold text-[#0B0B0B]">{inv.workspace_name}</p><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role: {inv.role}</p></div>
                    <PrimaryButton onClick={() => acceptInvite(inv)} disabled={busy}>Accept & Join</PrimaryButton>
                  </div>
                ))}
              </div>
            </Card>
          </AnimatedSection>
        )}

        <AnimatedSection index={1}>
          <Card title="Create a Team Workspace">
            <p className="text-sm text-gray-500 font-medium mb-6 leading-relaxed">
              Spin up a shared workspace to invite teammates, share analyses, and build collective intelligence.
              {profile?.tier === 'free' || profile?.tier === 'pro'
                ? ' Creating one upgrades you to the Team plan (simulated billing).'
                : ''}
            </p>
            <div className="space-y-4 max-w-xl">
              <Input label="Workspace name" placeholder="e.g. Acme Growth Team" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Description (optional)" placeholder="What this workspace is for" value={description} onChange={(e) => setDescription(e.target.value)} multiline />
              <PrimaryButton onClick={createWorkspace} disabled={busy}>{busy ? 'Creating…' : 'Create Workspace'}</PrimaryButton>
            </div>
          </Card>
        </AnimatedSection>
      </div>
    );
  }

  // --- Active workspace ---
  return (
    <div className="space-y-8">
      <PageHeader title={workspace.name} subtitle={workspace.description || 'Team Workspace'} />

      {/* Workspace selector (if user belongs to several) */}
      {workspaceMemberships.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {workspaceMemberships.map(m => (
            <button key={m.containerId} onClick={() => { setActiveId(m.containerId); setScope({ level: 'team', workspaceId: m.containerId }); }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest border transition-colors ${activeId === m.containerId ? 'bg-[#0B0B0B] text-white border-[#0B0B0B]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-900/50 overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-all relative ${tab === t ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            {t}
            {tab === t && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF0000] rounded-full" />}
          </button>
        ))}
      </div>

      {error && <ErrorMessage message={error} />}

      {tab === 'Overview' && <TeamOverview workspace={workspace} onQuickAction={handleQuickAction} />}
      {tab === 'Members' && (
        <div className="space-y-6">
          <CapacityPanel
            title="Plan capacity & expansions"
            rows={[{
              label: 'Members',
              used: members.length,
              cap: (DEFAULT_PRICING_CONFIG.plans.team.membersPerWorkspace || 0) + (workspace?.extra_seats || 0),
              ...(workspace && workspace.owner_id === user?.uid ? {
                buyLabel: `Add seat $${DEFAULT_PRICING_CONFIG.expansion.member}`,
                onBuy: async () => { await callPurchaseExpansion({ type: 'member', level: 'workspace', containerId: workspace.id }); await loadWorkspace(); },
              } : {}),
            }]}
          />
          <TeamMembers workspace={workspace} members={members} membership={membership} selfUid={user?.uid || ''} onReload={loadWorkspace} />
        </div>
      )}
      {tab === 'Library' && <SharedLibrary workspace={workspace} selfUid={user?.uid || ''} selfName={selfName} />}
      {tab === 'Reports' && <TeamReports workspace={workspace} />}
      {tab === 'Analytics' && <TeamAnalytics workspace={workspace} />}
      {tab === 'Activity' && <TeamActivity workspace={workspace} />}
      {tab === 'Settings' && <TeamSettings workspace={workspace} membership={membership} members={members} selfUid={user?.uid || ''} onChanged={loadWorkspace} />}
    </div>
  );
};

export default TeamWorkspace;
