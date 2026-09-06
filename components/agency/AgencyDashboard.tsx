// Agency Hub — Dashboard panel (Phase 6.2)
import React from 'react';
import { Card, Stat, SecondaryButton, Badge, EmptyState } from '../UI';
import { Agency, AgencyClient, WorkspaceMember } from '../../types';

const STATUS_TONE: Record<string, 'green' | 'blue' | 'yellow' | 'neutral'> = {
  active: 'green', growing: 'blue', at_risk: 'yellow', inactive: 'neutral',
};

const QUICK_ACTIONS = [
  { label: 'Add Client', tab: 'Clients' },
  { label: 'Invite Team Member', tab: 'Members' },
  { label: 'Agency Settings', tab: 'Settings' },
];

const AgencyDashboard: React.FC<{
  agency: Agency; clients: AgencyClient[]; members: WorkspaceMember[];
  onQuickAction: (tab: string) => void; onOpenClient: (c: AgencyClient) => void;
}> = ({ agency, clients, members, onQuickAction, onOpenClient }) => {
  const activeClients = clients.filter(c => c.status === 'active' || c.status === 'growing').length;
  const totalAnalyses = clients.reduce((s, c) => s + (c.analysis_count || 0), 0);
  const topClients = [...clients].sort((a, b) => (b.analysis_count || 0) - (a.analysis_count || 0)).slice(0, 5);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card><Stat label="Total Clients" value={clients.length} /></Card>
        <Card><Stat label="Active Clients" value={activeClients} /></Card>
        <Card><Stat label="Team Members" value={members.length} /></Card>
        <Card><Stat label="Analyses" value={totalAnalyses} /></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {QUICK_ACTIONS.map(a => (
          <SecondaryButton key={a.tab} tone="dark" size="sm" onClick={() => onQuickAction(a.tab)}>{a.label}</SecondaryButton>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Client Health">
          {clients.length === 0 ? <EmptyState message="No clients yet" submessage="Add your first client to start tracking client health." /> : (
            <div className="space-y-3">
              {clients.slice(0, 8).map(c => (
                <button key={c.id} onClick={() => onOpenClient(c)} className="w-full flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-colors text-left">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0B0B0B] truncate">{c.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{c.industry || 'No industry'}</p>
                  </div>
                  <Badge tone={STATUS_TONE[c.status] || 'neutral'}>{c.status.replace('_', ' ')}</Badge>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title="Agency Intelligence">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Most active clients</p>
          {topClients.length === 0 ? <p className="text-sm text-gray-400 font-medium">No activity yet.</p> : (
            <div className="space-y-2">
              {topClients.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-4">
                  <span className="text-xs font-bold text-[#0B0B0B] truncate">{c.name}</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">{c.analysis_count || 0} analyses</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AgencyDashboard;
