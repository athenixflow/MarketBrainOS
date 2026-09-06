// Agency Hub — container page (Phase 6.2)
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  PageHeader, Card, PrimaryButton, SecondaryButton, Input, Select, LoadingState, ErrorMessage, Tabs, Badge, PermissionDenied,
} from '../components/UI';
import AnimatedSection from '../components/AnimatedSection';
import { useAuth } from '../context/AuthContext';
import { useScope } from '../context/ScopeContext';
import { Membership, can, ROLE_LABELS } from '../services/permissionService';
import { Agency, AgencyClient, WorkspaceMember, AgencyInvitation } from '../types';
import {
  getAgency, getAgencyClients, getClient, getAgencyMembers, getUserClientAssignments,
  getAgencyInvitations, callManageAgency, callManageAgencyMember,
} from '../services/persistenceService';
import AgencyDashboard from '../components/agency/AgencyDashboard';
import ClientDirectory from '../components/agency/ClientDirectory';
import ClientWorkspace from '../components/agency/ClientWorkspace';
import AgencyMembers from '../components/agency/AgencyMembers';
import AgencyAnalytics from '../components/agency/AgencyAnalytics';
import TokenBudgets from '../components/agency/TokenBudgets';
import CapacityPanel from '../components/CapacityPanel';
import { callPurchaseExpansion } from '../services/persistenceService';
import { DEFAULT_PRICING_CONFIG } from '../config/pricingConfig';

const TABS = ['Dashboard', 'Clients', 'Members', 'Analytics', 'Budgets', 'Settings'] as const;
type Tab = typeof TABS[number];

// Container switcher pills sit on the dark page, so the active state is white-on-dark.
const switcherPill = (on: boolean) =>
  `px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${
    on ? 'bg-white text-[#0B0B0B] border-white' : 'border-gray-700 text-gray-400 hover:border-white hover:text-white'
  }`;

const AgencyHub: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { memberships, setScope, resetToPersonal, refreshMemberships } = useScope();
  const agencyMemberships = useMemo(() => memberships.filter(m => m.family === 'agency'), [memberships]);

  const [activeId, setActiveId] = useState('');
  const [agency, setAgency] = useState<Agency | null>(null);
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<AgencyInvitation[]>([]);
  const [selectedClient, setSelectedClient] = useState<AgencyClient | null>(null);
  const [tab, setTab] = useState<Tab>('Dashboard');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => { setActiveId(agencyMemberships[0]?.containerId || ''); }, [agencyMemberships]);

  const selfMember = members.find(m => m.uid === user?.uid);
  const membership: Membership | null = selfMember ? { family: 'agency', role: selfMember.role as any } : null;
  const isPrivileged = selfMember?.role === 'agency_owner' || selfMember?.role === 'agency_director';
  const selfName = profile?.email || user?.email || 'You';

  const loadAgency = useCallback(async () => {
    if (!activeId || !user) { setAgency(null); setClients([]); setMembers([]); return; }
    const [ag, mem] = await Promise.all([getAgency(activeId), getAgencyMembers(activeId)]);
    setAgency(ag); setMembers(mem);
    const myRole = mem.find(m => m.uid === user.uid)?.role;
    const privileged = myRole === 'agency_owner' || myRole === 'agency_director';
    // Non-privileged members can only read clients they're assigned to (rules enforce this).
    if (privileged) {
      setClients(await getAgencyClients(activeId));
    } else {
      const mine = (await getUserClientAssignments(user.uid)).filter(a => a.agency_id === activeId);
      const cs = await Promise.all(mine.map(a => getClient(a.client_id)));
      setClients(cs.filter(Boolean) as AgencyClient[]);
    }
  }, [activeId, user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (user?.email) setInvites(await getAgencyInvitations(user.email));
      await loadAgency();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, loadAgency]);

  const createAgency = async () => {
    if (name.trim().length < 2) { setError('Enter an agency name.'); return; }
    setError(''); setBusy(true);
    try {
      const res: any = await callManageAgency('create', { name: name.trim(), description: description.trim() });
      await refreshProfile(); await refreshMemberships();
      if (res?.agencyId) setActiveId(res.agencyId);
      setName(''); setDescription('');
    } catch (e: any) { setError(e.message || 'Could not create agency.'); }
    finally { setBusy(false); }
  };

  const acceptInvite = async (inv: AgencyInvitation) => {
    setBusy(true); setError('');
    try {
      await callManageAgencyMember('accept', { agencyId: inv.agency_id, invitationId: inv.id });
      await refreshMemberships();
      if (user?.email) setInvites(await getAgencyInvitations(user.email));
      setActiveId(inv.agency_id);
    } catch (e: any) { setError(e.message || 'Could not accept invite.'); }
    finally { setBusy(false); }
  };

  // Agency settings (inline)
  const [agName, setAgName] = useState('');
  useEffect(() => { setAgName(agency?.name || ''); }, [agency]);
  const [transferTo, setTransferTo] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const saveAgency = async () => { try { await callManageAgency('update', { agencyId: activeId, name: agName }); loadAgency(); } catch (e: any) { setError(e.message); } };
  const archiveAgency = async () => { try { await callManageAgency('archive', { agencyId: activeId }); resetToPersonal(); await refreshMemberships(); } catch (e: any) { setError(e.message); } };
  const transferAgency = async () => { if (!transferTo) return; try { await callManageAgency('transfer', { agencyId: activeId, targetUid: transferTo }); loadAgency(); } catch (e: any) { setError(e.message); } };

  if (loading) return <LoadingState message="Loading your agency…" />;

  if (!agency) {
    return (
      <div>
        <PageHeader title="Agency Hub" subtitle="Manage multiple clients from one account — isolated workspaces, reports, and intelligence." />
        <div className="space-y-10">
          {error && <ErrorMessage message={error} />}
          {invites.length > 0 && (
            <AnimatedSection index={0}><Card title="Pending invitations">
              <div className="space-y-3">{invites.map(inv => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0B0B0B] truncate">{inv.agency_name}</p>
                    <div className="mt-1.5"><Badge tone="neutral">{ROLE_LABELS[inv.role] || inv.role.replace('_', ' ')}</Badge></div>
                  </div>
                  <PrimaryButton size="sm" onClick={() => acceptInvite(inv)} disabled={busy}>Accept & Join</PrimaryButton>
                </div>
              ))}</div>
            </Card></AnimatedSection>
          )}
          <AnimatedSection index={1}><Card title="Create an Agency">
            <p className="text-sm text-gray-500 font-medium mb-6 leading-relaxed">
              Set up an agency to manage multiple clients with isolated data, team assignments, and per-client intelligence.
              {profile?.tier !== 'agency' && profile?.tier !== 'enterprise' ? ' Creating one upgrades you to the Agency plan.' : ''}
            </p>
            <div className="max-w-xl">
              <Input label="Agency name" placeholder="e.g. Northwind Growth Partners" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Description (optional)" placeholder="What your agency does" value={description} onChange={(e) => setDescription(e.target.value)} multiline />
              <PrimaryButton onClick={createAgency} disabled={busy}>{busy ? 'Creating…' : 'Create Agency'}</PrimaryButton>
            </div>
          </Card></AnimatedSection>
        </div>
      </div>
    );
  }

  // Client workspace view (nested)
  if (selectedClient) {
    return (
      <ClientWorkspace
        agency={agency} client={selectedClient} agencyMembers={members} membership={membership}
        selfUid={user?.uid || ''} selfName={selfName}
        onBack={() => { setSelectedClient(null); }}
        onChanged={loadAgency}
      />
    );
  }

  const openClient = (c: AgencyClient) => setSelectedClient(c);

  return (
    <div>
      <PageHeader title={agency.name} subtitle={agency.description || 'Agency Hub'} />

      {agencyMemberships.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-8" role="group" aria-label="Switch agency">
          {agencyMemberships.map(m => (
            <button key={m.containerId} aria-pressed={activeId === m.containerId} onClick={() => setActiveId(m.containerId)} className={switcherPill(activeId === m.containerId)}>{m.name}</button>
          ))}
        </div>
      )}

      <Tabs tabs={[...TABS]} activeTab={tab} onTabChange={(t) => setTab(t as Tab)} tone="dark" />

      <div className="space-y-8">
        {error && <ErrorMessage message={error} />}

        {tab === 'Dashboard' && <AgencyDashboard agency={agency} clients={clients} members={members} onQuickAction={(t) => setTab(t as Tab)} onOpenClient={openClient} />}
        {tab === 'Clients' && <ClientDirectory agency={agency} clients={clients} canManage={can('clients:manage', membership)} onOpenClient={openClient} onReload={loadAgency} />}
        {tab === 'Members' && <AgencyMembers agency={agency} members={members} membership={membership} selfUid={user?.uid || ''} onReload={loadAgency} />}
        {tab === 'Analytics' && <AgencyAnalytics agency={agency} clients={clients} members={members} />}
        {tab === 'Budgets' && (
          <div className="space-y-6">
            <CapacityPanel
              title="Plan capacity & expansions"
              rows={[
                {
                  label: 'Workspaces (clients)',
                  used: clients.length,
                  cap: (DEFAULT_PRICING_CONFIG.plans.agency.workspaces || 0) + (agency?.extra_workspaces || 0),
                  ...(agency?.owner_id === user?.uid ? {
                    buyLabel: `Add workspace $${DEFAULT_PRICING_CONFIG.expansion.workspace}`,
                    onBuy: async () => { await callPurchaseExpansion({ type: 'workspace', level: 'agency', containerId: activeId }); await loadAgency(); },
                  } : {}),
                },
                {
                  label: 'Members',
                  used: agency?.member_count || members.length,
                  cap: (DEFAULT_PRICING_CONFIG.plans.agency.maxMembers || 0) + (agency?.extra_members || 0),
                  ...(agency?.owner_id === user?.uid ? {
                    buyLabel: `Add seat $${DEFAULT_PRICING_CONFIG.expansion.member}`,
                    onBuy: async () => { await callPurchaseExpansion({ type: 'member', level: 'agency', containerId: activeId }); await loadAgency(); },
                  } : {}),
                },
              ]}
            />
            <TokenBudgets agency={agency} clients={clients} agencyId={activeId} canManage={can('clients:manage', membership)} onReload={loadAgency} />
          </div>
        )}
        {tab === 'Settings' && (
          can('settings:manage', membership) ? (
            <div className="space-y-6 max-w-2xl">
              <Card title="General">
                <Input label="Agency name" placeholder="Agency name" value={agName} onChange={(e) => setAgName(e.target.value)} />
                <PrimaryButton onClick={saveAgency}>Save changes</PrimaryButton>
              </Card>
              {isPrivileged && selfMember?.role === 'agency_owner' && (
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
                          ...members.filter(m => m.uid !== user?.uid).map(m => ({ value: m.uid, label: m.email })),
                        ]}
                      />
                      <div className="mt-4">
                        <SecondaryButton size="sm" onClick={transferAgency} disabled={!transferTo}>Transfer ownership</SecondaryButton>
                      </div>
                    </div>
                    <div className="pt-8 border-t border-gray-100">
                      <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-2">Archive agency</p>
                      <p className="text-xs text-gray-500 mb-4 leading-relaxed">Archiving disables the agency for every member.</p>
                      {confirmArchive ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <PrimaryButton size="sm" onClick={archiveAgency}>Yes, archive agency</PrimaryButton>
                          <SecondaryButton size="sm" onClick={() => setConfirmArchive(false)}>Cancel</SecondaryButton>
                        </div>
                      ) : (
                        <SecondaryButton size="sm" onClick={() => setConfirmArchive(true)}>Archive agency</SecondaryButton>
                      )}
                    </div>
                  </div>
                </Card>
              )}
            </div>
          ) : <PermissionDenied message="You do not have permission to manage agency settings" />
        )}
      </div>
    </div>
  );
};

export default AgencyHub;
