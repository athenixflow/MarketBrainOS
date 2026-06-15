// Agency Hub — container page (Phase 6.2)
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { PageHeader, Card, PrimaryButton, Input, LoadingState, ErrorMessage } from '../components/UI';
import AnimatedSection from '../components/AnimatedSection';
import { useAuth } from '../context/AuthContext';
import { useScope } from '../context/ScopeContext';
import { Membership, can } from '../services/permissionService';
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
  const saveAgency = async () => { try { await callManageAgency('update', { agencyId: activeId, name: agName }); loadAgency(); } catch (e: any) { setError(e.message); } };
  const archiveAgency = async () => { try { await callManageAgency('archive', { agencyId: activeId }); resetToPersonal(); await refreshMemberships(); } catch (e: any) { setError(e.message); } };
  const transferAgency = async () => { if (!transferTo) return; try { await callManageAgency('transfer', { agencyId: activeId, targetUid: transferTo }); loadAgency(); } catch (e: any) { setError(e.message); } };

  if (loading) return <LoadingState message="Loading your agency…" />;

  if (!agency) {
    return (
      <div className="space-y-10">
        <PageHeader title="Agency Hub" subtitle="Manage multiple clients from one account — isolated workspaces, reports, and intelligence." />
        {error && <ErrorMessage message={error} />}
        {invites.length > 0 && (
          <AnimatedSection index={0}><Card title="Pending invitations">
            <div className="space-y-3">{invites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 flex-wrap">
                <div><p className="text-sm font-bold text-[#0B0B0B]">{inv.agency_name}</p><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role: {inv.role.replace('_', ' ')}</p></div>
                <PrimaryButton onClick={() => acceptInvite(inv)} disabled={busy}>Accept & Join</PrimaryButton>
              </div>
            ))}</div>
          </Card></AnimatedSection>
        )}
        <AnimatedSection index={1}><Card title="Create an Agency">
          <p className="text-sm text-gray-500 font-medium mb-6 leading-relaxed">
            Set up an agency to manage multiple clients with isolated data, team assignments, and per-client intelligence.
            {profile?.tier !== 'agency' && profile?.tier !== 'enterprise' ? ' Creating one upgrades you to the Agency plan (simulated billing).' : ''}
          </p>
          <div className="space-y-4 max-w-xl">
            <Input label="Agency name" placeholder="e.g. Northwind Growth Partners" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Description (optional)" placeholder="What your agency does" value={description} onChange={(e) => setDescription(e.target.value)} multiline />
            <PrimaryButton onClick={createAgency} disabled={busy}>{busy ? 'Creating…' : 'Create Agency'}</PrimaryButton>
          </div>
        </Card></AnimatedSection>
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
    <div className="space-y-8">
      <PageHeader title={agency.name} subtitle={agency.description || 'Agency Hub'} />

      {agencyMemberships.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {agencyMemberships.map(m => (
            <button key={m.containerId} onClick={() => setActiveId(m.containerId)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest border transition-colors ${activeId === m.containerId ? 'bg-[#0B0B0B] text-white border-[#0B0B0B]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>{m.name}</button>
          ))}
        </div>
      )}

      <div className="flex gap-6 border-b border-gray-100 overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`pb-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-all relative ${tab === t ? 'text-[#0B0B0B]' : 'text-gray-400 hover:text-gray-600'}`}>
            {t}{tab === t && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF0000] rounded-full" />}
          </button>
        ))}
      </div>

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
              <div className="space-y-4">
                <Input label="Agency name" placeholder="Agency name" value={agName} onChange={(e) => setAgName(e.target.value)} />
                <PrimaryButton onClick={saveAgency}>Save changes</PrimaryButton>
              </div>
            </Card>
            {isPrivileged && selfMember?.role === 'agency_owner' && (
              <Card title="Ownership & lifecycle">
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-3 tracking-widest uppercase">Transfer ownership</label>
                    <div className="flex gap-2">
                      <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className="flex-grow bg-[#FBFBFB] border border-gray-100 p-4 rounded-2xl text-sm outline-none">
                        <option value="">Select a member…</option>
                        {members.filter(m => m.uid !== user?.uid).map(m => <option key={m.uid} value={m.uid}>{m.email}</option>)}
                      </select>
                      <button onClick={transferAgency} disabled={!transferTo} className="px-5 rounded-xl bg-[#0B0B0B] text-white text-[11px] font-bold uppercase tracking-widest disabled:opacity-30">Transfer</button>
                    </div>
                  </div>
                  <div className="pt-6 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-2">Danger zone</p>
                    <button onClick={archiveAgency} className="px-5 py-3 rounded-xl border border-red-200 text-[#FF0000] text-[11px] font-bold uppercase tracking-widest hover:bg-red-50 transition-colors">Archive agency</button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        ) : <p className="text-gray-400 text-sm font-medium py-8">You don't have permission to manage agency settings.</p>
      )}
    </div>
  );
};

export default AgencyHub;
