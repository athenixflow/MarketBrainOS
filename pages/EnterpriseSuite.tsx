// Enterprise Analytics Suite — container page (Phase 6.3)
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  PageHeader, Card, PrimaryButton, SecondaryButton, Input, Select, LoadingState, ErrorMessage, Tabs, Badge, PermissionDenied,
} from '../components/UI';
import AnimatedSection from '../components/AnimatedSection';
import { useAuth } from '../context/AuthContext';
import { useScope } from '../context/ScopeContext';
import { Membership, can, ROLE_LABELS } from '../services/permissionService';
import {
  Enterprise, WorkspaceMember, EnterpriseDepartment, EnterpriseBrand,
  EnterpriseHealthScore, EnterpriseAnalyticsSnapshot, EnterpriseForecast, EnterpriseBriefing, EnterpriseInvitation,
} from '../types';
import {
  getEnterprise, getEnterpriseMembers, getEnterpriseDepartments, getEnterpriseBrands,
  getLatestHealthScore, getLatestAnalyticsSnapshot, getEnterpriseForecasts, getEnterpriseBriefings,
  getEnterpriseInvitations, callManageEnterprise, callManageEnterpriseMember, callRunEnterpriseAggregation, callPurchaseExpansion,
  getAgenciesByIds,
} from '../services/persistenceService';
import { DEFAULT_PRICING_CONFIG } from '../config/pricingConfig';
import CapacityPanel from '../components/CapacityPanel';
import EnterpriseDashboard from '../components/enterprise/EnterpriseDashboard';
import EnterpriseIntelligence from '../components/enterprise/EnterpriseIntelligence';
import EnterprisePerformance from '../components/enterprise/EnterprisePerformance';
import EnterpriseStructure from '../components/enterprise/EnterpriseStructure';
import EnterpriseBriefings from '../components/enterprise/EnterpriseBriefings';
import EnterpriseMembers from '../components/enterprise/EnterpriseMembers';
import EnterpriseBudgets from '../components/enterprise/EnterpriseBudgets';

const TABS = ['Dashboard', 'Intelligence', 'Performance', 'Briefings', 'Structure', 'Members', 'Budgets', 'Settings'] as const;
type Tab = typeof TABS[number];

// Container switcher pills sit on the dark page, so the active state is white-on-dark.
const switcherPill = (on: boolean) =>
  `px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${
    on ? 'bg-white text-[#0B0B0B] border-white' : 'border-gray-700 text-gray-400 hover:border-white hover:text-white'
  }`;

// Link toggles live inside a white Card, so the "on" state is the dark chip.
const linkChip = (on: boolean) =>
  `px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors ${
    on ? 'bg-[#0B0B0B] text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
  }`;

const EnterpriseSuite: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { memberships, resetToPersonal, refreshMemberships } = useScope();
  const entMemberships = useMemo(() => memberships.filter(m => m.family === 'enterprise'), [memberships]);
  const linkableWorkspaces = useMemo(() => memberships.filter(m => m.family === 'workspace'), [memberships]);
  const linkableAgencies = useMemo(() => memberships.filter(m => m.family === 'agency'), [memberships]);

  const [activeId, setActiveId] = useState('');
  const [enterprise, setEnterprise] = useState<Enterprise | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [departments, setDepartments] = useState<EnterpriseDepartment[]>([]);
  const [brands, setBrands] = useState<EnterpriseBrand[]>([]);
  const [health, setHealth] = useState<EnterpriseHealthScore | null>(null);
  const [analytics, setAnalytics] = useState<EnterpriseAnalyticsSnapshot | null>(null);
  const [forecasts, setForecasts] = useState<EnterpriseForecast[]>([]);
  const [briefings, setBriefings] = useState<EnterpriseBriefing[]>([]);
  const [invites, setInvites] = useState<EnterpriseInvitation[]>([]);
  const [linkedAgencies, setLinkedAgencies] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('Dashboard');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => { setActiveId(entMemberships[0]?.containerId || ''); }, [entMemberships]);

  const selfMember = members.find(m => m.uid === user?.uid);
  const membership: Membership | null = selfMember ? { family: 'enterprise', role: selfMember.role as any } : null;
  const isOwner = selfMember?.role === 'enterprise_owner';

  const loadAll = useCallback(async () => {
    if (!activeId) { setEnterprise(null); return; }
    const [ent, mem, depts, brs, h, a, f, b] = await Promise.all([
      getEnterprise(activeId), getEnterpriseMembers(activeId), getEnterpriseDepartments(activeId), getEnterpriseBrands(activeId),
      getLatestHealthScore(activeId), getLatestAnalyticsSnapshot(activeId), getEnterpriseForecasts(activeId), getEnterpriseBriefings(activeId),
    ]);
    setEnterprise(ent); setMembers(mem); setDepartments(depts); setBrands(brs);
    setHealth(h); setAnalytics(a); setForecasts(f); setBriefings(b);
    setLinkedAgencies(await getAgenciesByIds((ent as any)?.linked_agencies || []));
  }, [activeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (user?.email) setInvites(await getEnterpriseInvitations(user.email));
      await loadAll();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, loadAll]);

  const create = async () => {
    if (name.trim().length < 2) { setError('Enter an enterprise name.'); return; }
    setError(''); setBusy(true);
    try {
      const res: any = await callManageEnterprise('create', { name: name.trim(), description: description.trim() });
      await refreshProfile(); await refreshMemberships();
      if (res?.enterpriseId) setActiveId(res.enterpriseId);
      setName(''); setDescription('');
    } catch (e: any) { setError(e.message || 'Could not create enterprise.'); }
    finally { setBusy(false); }
  };

  const acceptInvite = async (inv: EnterpriseInvitation) => {
    setBusy(true); setError('');
    try { await callManageEnterpriseMember('accept', { enterpriseId: inv.enterprise_id, invitationId: inv.id }); await refreshMemberships(); if (user?.email) setInvites(await getEnterpriseInvitations(user.email)); setActiveId(inv.enterprise_id); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const refreshAnalytics = async () => {
    setRefreshing(true); setError('');
    try { await callRunEnterpriseAggregation(activeId); await loadAll(); }
    catch (e: any) { setError(e.message || 'We could not aggregate this data right now. Please try again later.'); }
    finally { setRefreshing(false); }
  };

  // Settings
  const [entName, setEntName] = useState('');
  useEffect(() => { setEntName(enterprise?.name || ''); }, [enterprise]);
  const [transferTo, setTransferTo] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const saveEnt = async () => { try { await callManageEnterprise('update', { enterpriseId: activeId, name: entName }); loadAll(); } catch (e: any) { setError(e.message); } };
  const archiveEnt = async () => { try { await callManageEnterprise('archive', { enterpriseId: activeId }); resetToPersonal(); await refreshMemberships(); } catch (e: any) { setError(e.message); } };
  const transferEnt = async () => { if (!transferTo) return; try { await callManageEnterprise('transfer', { enterpriseId: activeId, targetUid: transferTo }); loadAll(); } catch (e: any) { setError(e.message); } };
  const toggleLink = async (kind: 'workspace' | 'agency', id: string) => {
    if (!enterprise) return;
    const key = kind === 'workspace' ? 'linked_workspaces' : 'linked_agencies';
    const cur = (enterprise as any)[key] as string[] || [];
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
    try { await callManageEnterprise('link', { enterpriseId: activeId, [key]: next }); loadAll(); } catch (e: any) { setError(e.message); }
  };

  if (loading) return <LoadingState message="Loading the enterprise suite…" />;

  if (!enterprise) {
    return (
      <div>
        <PageHeader title="Enterprise Suite" subtitle="Executive intelligence across your entire organization — health, risks, opportunities, forecasts, and AI briefings." />
        <div className="space-y-10">
          {error && <ErrorMessage message={error} />}
          {invites.length > 0 && (
            <AnimatedSection index={0}><Card title="Pending invitations">
              <div className="space-y-3">{invites.map(inv => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0B0B0B] truncate">{inv.enterprise_name}</p>
                    <div className="mt-1.5"><Badge tone="neutral">{ROLE_LABELS[inv.role] || inv.role.replace('_', ' ')}</Badge></div>
                  </div>
                  <PrimaryButton size="sm" onClick={() => acceptInvite(inv)} disabled={busy}>Accept & Join</PrimaryButton>
                </div>
              ))}</div>
            </Card></AnimatedSection>
          )}
          <AnimatedSection index={1}><Card title="Create an Enterprise organization">
            <p className="text-sm text-gray-500 font-medium mb-6 leading-relaxed">
              The Enterprise layer aggregates intelligence across all your teams and agencies — it never alters underlying work.
              {profile?.tier !== 'enterprise' ? ' Creating one upgrades you to the Enterprise plan.' : ''}
            </p>
            <div className="max-w-xl">
              <Input label="Organization name" placeholder="e.g. Northwind Holdings" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Description (optional)" placeholder="What your organization does" value={description} onChange={(e) => setDescription(e.target.value)} multiline />
              <PrimaryButton onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create Enterprise'}</PrimaryButton>
            </div>
          </Card></AnimatedSection>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={enterprise.name} subtitle={enterprise.description || 'Enterprise Analytics Suite'} />

      {entMemberships.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-8" role="group" aria-label="Switch organization">
          {entMemberships.map(m => (
            <button key={m.containerId} aria-pressed={activeId === m.containerId} onClick={() => setActiveId(m.containerId)} className={switcherPill(activeId === m.containerId)}>{m.name}</button>
          ))}
        </div>
      )}

      <Tabs tabs={[...TABS]} activeTab={tab} onTabChange={(t) => setTab(t as Tab)} tone="dark" />

      <div className="space-y-8">
        {error && <ErrorMessage message={error} />}

        {tab === 'Dashboard' && <EnterpriseDashboard enterprise={enterprise} health={health} analytics={analytics} memberCount={members.length} onRefresh={refreshAnalytics} refreshing={refreshing} onQuickAction={(t) => setTab(t as Tab)} />}
        {tab === 'Intelligence' && <EnterpriseIntelligence latest={briefings[0] || null} forecasts={forecasts} />}
        {tab === 'Performance' && <EnterprisePerformance analytics={analytics} departments={departments} brands={brands} />}
        {tab === 'Briefings' && <EnterpriseBriefings enterprise={enterprise} briefings={briefings} canGenerate={can('reports:create', membership)} onReload={loadAll} />}
        {tab === 'Structure' && <EnterpriseStructure enterprise={enterprise} departments={departments} brands={brands} canManage={can('departments:manage', membership)} onReload={loadAll} />}
        {tab === 'Members' && (
          <div className="space-y-6">
            <CapacityPanel
              title="Plan capacity & expansions"
              rows={[
                {
                  label: 'Agencies',
                  used: (enterprise?.linked_agencies || []).length,
                  cap: (DEFAULT_PRICING_CONFIG.plans.enterprise.agencies || 0) + (enterprise?.extra_agencies || 0),
                  ...(enterprise && enterprise.owner_id === user?.uid ? {
                    buyLabel: `Add agency $${DEFAULT_PRICING_CONFIG.expansion.agency}`,
                    onBuy: async () => { await callPurchaseExpansion({ type: 'agency', level: 'enterprise', containerId: enterprise.id }); await loadAll(); },
                  } : {}),
                },
                {
                  label: 'Members',
                  used: members.length,
                  cap: (DEFAULT_PRICING_CONFIG.plans.enterprise.maxMembers || 0) + (enterprise?.extra_members || 0),
                  ...(enterprise && enterprise.owner_id === user?.uid ? {
                    buyLabel: `Add seat $${DEFAULT_PRICING_CONFIG.expansion.member}`,
                    onBuy: async () => { await callPurchaseExpansion({ type: 'member', level: 'enterprise', containerId: enterprise.id }); await loadAll(); },
                  } : {}),
                },
              ]}
            />
            <EnterpriseMembers enterprise={enterprise} members={members} membership={membership} selfUid={user?.uid || ''} onReload={loadAll} />
          </div>
        )}
        {tab === 'Budgets' && (
          <EnterpriseBudgets enterprise={enterprise} agencies={linkedAgencies} enterpriseId={activeId} canManage={enterprise?.owner_id === user?.uid} onReload={loadAll} />
        )}
        {tab === 'Settings' && (
          can('settings:manage', membership) ? (
            <div className="space-y-6 max-w-2xl">
              <Card title="General">
                <Input label="Organization name" placeholder="Organization name" value={entName} onChange={(e) => setEntName(e.target.value)} />
                <PrimaryButton onClick={saveEnt}>Save changes</PrimaryButton>
              </Card>
              <Card title="Linked containers (aggregation scope)">
                <p className="text-xs text-gray-500 mb-6">Select which teams and agencies the analytics engine aggregates over.</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Teams</p>
                {linkableWorkspaces.length === 0 ? <p className="text-sm text-gray-400 font-medium mb-6">You do not belong to any teams yet.</p> : (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {linkableWorkspaces.map(w => {
                      const on = (enterprise.linked_workspaces || []).includes(w.containerId);
                      return <button key={w.containerId} aria-pressed={on} onClick={() => toggleLink('workspace', w.containerId)} className={linkChip(on)}>{w.name}</button>;
                    })}
                  </div>
                )}
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Agencies</p>
                {linkableAgencies.length === 0 ? <p className="text-sm text-gray-400 font-medium">You do not belong to any agencies yet.</p> : (
                  <div className="flex flex-wrap gap-2">
                    {linkableAgencies.map(a => {
                      const on = (enterprise.linked_agencies || []).includes(a.containerId);
                      return <button key={a.containerId} aria-pressed={on} onClick={() => toggleLink('agency', a.containerId)} className={linkChip(on)}>{a.name}</button>;
                    })}
                  </div>
                )}
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
                          ...members.filter(m => m.uid !== user?.uid).map(m => ({ value: m.uid, label: m.email })),
                        ]}
                      />
                      <div className="mt-4">
                        <SecondaryButton size="sm" onClick={transferEnt} disabled={!transferTo}>Transfer ownership</SecondaryButton>
                      </div>
                    </div>
                    <div className="pt-8 border-t border-gray-100">
                      <p className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest mb-2">Archive organization</p>
                      <p className="text-xs text-gray-500 mb-4 leading-relaxed">Archiving disables the organization for every member.</p>
                      {confirmArchive ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <PrimaryButton size="sm" onClick={archiveEnt}>Yes, archive organization</PrimaryButton>
                          <SecondaryButton size="sm" onClick={() => setConfirmArchive(false)}>Cancel</SecondaryButton>
                        </div>
                      ) : (
                        <SecondaryButton size="sm" onClick={() => setConfirmArchive(true)}>Archive organization</SecondaryButton>
                      )}
                    </div>
                  </div>
                </Card>
              )}
            </div>
          ) : <PermissionDenied message="You do not have permission to manage enterprise settings" />
        )}
      </div>
    </div>
  );
};

export default EnterpriseSuite;
